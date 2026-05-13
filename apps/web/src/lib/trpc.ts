import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../api/src/router/index';
export const trpc = createTRPCReact<AppRouter>();
