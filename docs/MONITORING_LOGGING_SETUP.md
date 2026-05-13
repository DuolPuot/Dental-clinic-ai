# 📊 Monitoring & Logging Setup Guide

## Overview

This guide covers setting up comprehensive monitoring and logging for the Dental Clinic AI Platform using Prometheus, Grafana, Loki, and Alertmanager.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           Docker Services                           │
│  ┌────────────┐  ┌────────┐  ┌────────┐           │
│  │     API    │  │MongoDB │  │ Redis  │           │
│  └─────┬──────┘  └───┬────┘  └───┬────┘           │
└────────┼──────────────┼──────────┼────────────────┘
         │              │          │
    ┌────▼──────┐   ┌──▼──────┐   └──┐
    │ Exporter  │   │ Exporter│      └──┐
    └────┬──────┘   └──┬──────┘         │
    ┌────▼─────────────▼────┐       ┌──▼────────┐
    │   Prometheus TSDB     │       │ Promtail  │
    │   (Time-Series DB)    │       └──┬────────┘
    └────┬──────────────────┘          │
    ┌────▼──────────────────┐    ┌────▼────────┐
    │  Alertmanager         │    │    Loki     │
    │  (Alert Routing)      │    │  (Logs)     │
    └────┬──────────────────┘    └────┬────────┘
    ┌────▼──────────────────────────┬─▼────────┐
    │        Grafana               │           │
    │    (Dashboards & Alerts)     │ Slack/PD  │
    └──────────────────────────────┴───────────┘
```

## Quick Start

### 1. Deploy Monitoring Stack

```bash
cd /opt/Dental-clinic-ai

# Start monitoring services
docker-compose -f docker-compose.yml \
  -f docker-compose.monitoring.yml up -d

# Verify services
docker-compose ps
```

### 2. Access Interfaces

| Service | URL | Credentials |
|---------|-----|-------------|
| Prometheus | http://your-domain:9090 | None |
| Grafana | http://your-domain:3001 | admin / (see .env) |
| Alertmanager | http://your-domain:9093 | None |
| Loki | http://your-domain:3100 | None |

### 3. Configure Grafana

1. Log in to Grafana (admin/changeme)
2. Change admin password
3. Add Prometheus data source:
   - URL: http://prometheus:9090
   - Save & Test
4. Add Loki data source:
   - URL: http://loki:3100
   - Save & Test
5. Import dashboards from `/monitoring/grafana/dashboards/`

## Detailed Setup

### Prometheus Configuration

Located at: `monitoring/prometheus.yml`

**Key Components:**
- **Scrape Interval**: 15 seconds (how often to collect metrics)
- **Evaluation Interval**: 15 seconds (how often to evaluate alerts)
- **Alert Rules**: Defined in `monitoring/alerts.yml`

**Add Custom Job:**

```yaml
scrape_configs:
  - job_name: 'custom-service'
    static_configs:
      - targets: ['localhost:9999']
    scrape_interval: 10s
    scrape_timeout: 5s
```

### MongoDB Metrics

The `mongodb-exporter` provides metrics like:
- Connection count
- Operation latency
- Document insert/update/delete rates
- Replication status
- Memory usage

**Query Examples:**

```promql
# MongoDB connection count
mongodb_connections

# Command latency (milliseconds)
rate(mongodb_mongod_op_latencies_latency_total[5m])

# Memory usage
mongodb_resident_memory_bytes

# Documents in collection
mongodb_dbstats_collections
```

### Redis Metrics

The `redis-exporter` provides:
- Connected clients
- Memory usage
- Key evictions
- Command rate
- Latency

**Query Examples:**

```promql
# Connected clients
redis_connected_clients

# Memory usage
redis_memory_used_bytes

# Keys in database
redis_db_keys

# Evicted keys rate
rate(redis_evicted_keys_total[5m])
```

### API Metrics

To instrument your Node.js API, add Prometheus client:

```bash
npm install prom-client
```

**Add to API (src/index.ts):**

```typescript
import { collectDefaultMetrics, register } from 'prom-client';

// Collect default metrics
collectDefaultMetrics();

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

**Restart API:**
```bash
docker-compose restart api
```

### Alert Rules

Located at: `monitoring/alerts.yml`

**Available Alerts:**

| Alert | Condition | Severity |
|-------|-----------|----------|
| MongoDBDown | No response | Critical |
| MongoDBHighMemory | > 1GB | Warning |
| RedisDown | No response | Critical |
| APIDown | No response | Critical |
| APIHighErrorRate | > 5% 5xx | Warning |
| HighCPUUsage | > 80% | Warning |
| HighMemoryUsage | > 85% | Warning |
| DiskSpaceRunningOut | > 85% | Warning |

**Add Custom Alert:**

```yaml
- alert: MyCustomAlert
  expr: my_metric > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Custom alert triggered"
    description: "Value: {{ $value }}"
```

### Alertmanager Configuration

Located at: `monitoring/alertmanager.yml`

**Features:**
- Alert grouping (by service, instance)
- Alert routing (critical vs warning)
- Slack/PagerDuty integration
- Alert suppression rules

**Setup Slack Notifications:**

1. Create Slack webhook: https://api.slack.com/messaging/webhooks
2. Add to `.env`:
   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```
3. Restart Alertmanager:
   ```bash
   docker-compose restart alertmanager
   ```

### Grafana Dashboards

**Create Dashboard:**

1. Log in to Grafana
2. Click "+" → "New Dashboard"
3. Add panel → Select Prometheus
4. Enter query: `up{job="api"}`
5. Configure visualization
6. Save dashboard

**Dashboard Templates:**

Located at: `monitoring/grafana/dashboards/`

- `system.json` - CPU, Memory, Disk
- `mongodb.json` - Database metrics
- `redis.json` - Cache metrics
- `api.json` - API performance
- `docker.json` - Container stats

**Import Dashboard:**

```bash
# Copy dashboard JSON
cp monitoring/grafana/dashboards/system.json /tmp/

# Use Grafana UI to import from JSON
# Dashboard → Import → Upload JSON
```

### Loki Log Aggregation

**Features:**
- Centralized log collection
- Full-text log search
- Log alerting
- 30-day retention

**Query Log Stream:**

1. In Grafana, select Loki data source
2. Enter LogQL query:
   ```
   {service="api"} | json | level="error"
   ```

**LogQL Examples:**

```
# All logs from API
{service="api"}

# Errors only
{service="api"} | level="error"

# JSON parsing
{service="api"} | json | status_code=500

# Metrics aggregation
sum(rate({service="api"} | level="error" [5m]))
```

### Promtail Log Collection

Located at: `monitoring/promtail-config.yml`

**Collects from:**
- System logs (/var/log/syslog)
- Docker container logs
- Application logs (/var/log/dental-clinic/)
- Nginx logs
- Event logs

**Add New Log Source:**

```yaml
- job_name: my-app
  static_configs:
    - targets:
        - localhost
      labels:
        job: my-app
        service: my-app
        __path__: /var/log/my-app/*.log
```

## Advanced Configuration

### High Availability

For production, use Docker Swarm or Kubernetes:

```bash
# Deploy on Swarm
docker stack deploy -c docker-compose.monitoring.yml monitoring
```

### External Alerting

**PagerDuty Integration:**

1. Create PagerDuty service
2. Get integration key
3. Add to `alertmanager.yml`:
   ```yaml
   pagerduty_configs:
     - service_key: 'YOUR-SERVICE-KEY'
   ```

**Email Alerts:**

```yaml
smtp_smarthost: 'smtp.gmail.com:587'
smtp_auth_username: 'your-email@gmail.com'
smtp_auth_password: 'your-app-password'

receivers:
  - name: 'email'
    email_configs:
      - to: 'alerts@example.com'
```

### Grafana Provisioning

Auto-provision data sources and dashboards:

```yaml
# monitoring/grafana/provisioning/datasources/prometheus.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

### Retention Policies

**Prometheus Retention:**
```bash
# 30 days (in docker-compose.monitoring.yml)
--storage.tsdb.retention.time=30d

# Max size
--storage.tsdb.retention.size=50GB
```

**Loki Retention:**
```yaml
# In loki-config.yml
retention_period: 30d  # or 720h
```

## Troubleshooting

### Prometheus Not Scraping

```bash
# Check Prometheus logs
docker-compose logs prometheus

# Test scrape target
curl http://mongodb-exporter:9216/metrics

# Check prometheus.yml syntax
curl http://localhost:9090/api/v1/rules
```

### Alerts Not Firing

```bash
# Check alert rules
docker exec dental_prometheus promtool check rules /etc/prometheus/rules/alerts.yml

# View active alerts
curl http://localhost:9090/api/v1/alerts

# Check Alertmanager
curl http://localhost:9093/api/v1/alerts
```

### High Memory Usage

**Reduce Retention:**
```yaml
# In prometheus.yml
--storage.tsdb.retention.time=7d  # Reduce from 30d
```

**Reduce Scrape Interval:**
```yaml
# In prometheus.yml
scrape_interval: 30s  # Increase from 15s
```

### Missing Metrics

```bash
# Check if exporter is running
curl http://localhost:9216/metrics  # MongoDB
curl http://localhost:9121/metrics  # Redis

# Check scrape config
docker-compose logs prometheus | grep -i target
```

## Maintenance

### Backup Grafana

```bash
# Export dashboards
docker exec dental_grafana grafana-cli admin export-dashboard \
  --output=/tmp/dashboard.json
```

### Clean Up Old Data

```bash
# Remove Prometheus data older than 15 days
docker exec dental_prometheus \
  promtool query instant 'prometheus_tsdb_retention_time_seconds'
```

### Update Exporters

```bash
# Update to latest versions
docker-compose pull node-exporter mongodb-exporter redis-exporter

# Restart
docker-compose -f docker-compose.monitoring.yml up -d
```

## Security

### Password Protection

1. Enable Grafana authentication
2. Use reverse proxy (Nginx) with SSL
3. Restrict Prometheus to internal only
4. Use firewall rules

### Audit Logging

```bash
# View Grafana audit log
docker exec dental_grafana tail -f /var/log/grafana/grafana.log
```

## Performance Tuning

### Optimize Queries

```promql
# Use rate() for counters
rate(http_requests_total[5m])

# Use increase() for gauge spikes
increase(http_requests_total[5m])

# Aggregate early
sum(rate(http_requests_total[5m])) by (handler)
```

### Dashboard Performance

- Limit panels to 10-15 per dashboard
- Use 5-minute intervals for graphs
- Use appropriate visualization types
- Cache frequently accessed data

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/grafana/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [MongoDB Exporter Metrics](https://github.com/percona/mongodb_exporter#metrics)

---

**Last Updated**: 2024-01-01
**Owner**: DevOps Team
