// MongoDB initialization script
// Runs once when the container is first created

db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || 'dental_clinic');

// Create application user with limited privileges
db.createUser({
  user: 'dental_app',
  pwd: process.env.MONGO_APP_PASSWORD || 'app_changeme',
  roles: [
    {
      role: 'readWrite',
      db: process.env.MONGO_INITDB_DATABASE || 'dental_clinic',
    },
  ],
});

// Create initial collections with schema validation placeholders
db.createCollection('patients');
db.createCollection('users');
db.createCollection('appointments');
db.createCollection('treatmentplans');
db.createCollection('invoices');
db.createCollection('auditlogs');
db.createCollection('notifications');
db.createCollection('feeschedules');
db.createCollection('operatories');

print('MongoDB initialization complete.');
