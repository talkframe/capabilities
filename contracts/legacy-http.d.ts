// Minimal declarations for the existing HTTP adapter until upstream Express/Multer
// type packages are installed. Only the API surface consumed by server.mjs is modeled.
declare module 'express' {
  interface Request {
    get(name: string): string | undefined;
    method: string;
    params: Record<string, string>;
    body: any;
    file?: {path: string; originalname: string};
  }
  interface Response {
    status(code: number): Response;
    json(body: unknown): Response;
    setHeader(name: string, value: string): void;
    sendStatus(code: number): Response;
    sendFile(path: string): void;
  }
  type Next = () => void;
  type Handler = (req: Request, res: Response, next: Next) => unknown;
  type ErrorHandler = (err: Error & {code?: string}, req: Request, res: Response, next: Next) => unknown;
  interface Application {
    use(handler: Handler): void;
    use(handler: ErrorHandler): void;
    use(path: string, handler: Handler): void;
    get(path: string, ...handlers: Handler[]): void;
    post(path: string, ...handlers: Handler[]): void;
    listen(port: number, host: string, callback: () => void): unknown;
  }
  interface Factory {
    (): Application;
    json(options: {limit: string}): Handler;
    static(path: string): Handler;
  }
  const express: Factory;
  export default express;
  export type {Request, Response, Next, Handler, ErrorHandler};
}
declare module 'multer' {
  function multer(options: {dest: string; limits: {fileSize: number; files: number}}): {
    single(field: string): import('express').Handler;
  };
  export default multer;
}
