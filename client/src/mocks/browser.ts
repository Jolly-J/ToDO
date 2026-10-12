/** MSW 浏览器端 Worker 初始化，用于本地开发接口 Mock */
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
