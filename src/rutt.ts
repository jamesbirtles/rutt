import * as Hapi from 'hapi';
import * as Boom from 'boom';

import { Route, Controller } from './route';

export interface RuttOptions extends Hapi.IServerOptions {
}

export interface RuttConnectionOptions extends Hapi.IServerConnectionOptions {
}

export interface RuttRequest extends Hapi.Request {
}

export interface RuttReply extends Hapi.IReply {
    _replied: boolean;
}

export interface RouteContext {
    controller?: Controller<any>;
    path: string;
}

export class Rutt {
    public server: Hapi.Server;
    private hapiRoutes: Hapi. IRouteConfiguration[];

    constructor(options?: RuttOptions) {
        this.server = new Hapi.Server(options);
    }

    start(options: RuttConnectionOptions): Promise<void> {
        this.server.connection(options);

        this.hapiRoutes.forEach(route => {
            console.log(`[${route.method}] ${route.path}`);
            this.server.route(route);
        });

        return new Promise((resolve, reject) => {
            this.server.start(err => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });
    }

    routes(routes: Route[]) {
        this.hapiRoutes = this.compileRoutes(routes);
    }

    private compileRoutes(routes: Route[], context: RouteContext = { path: '' }) {
        const hapiRoutes = [];
        routes.forEach(route => {
            const ctx = Object.assign({}, context);

            // Assemble path based on the parent routes.
            if (route.path) {
                let path = route.path;
                if (path.startsWith(':')) {
                    path = `{${path.slice(1)}}`;
                }

                ctx.path += `/${path}`;
            }

            // Replace the controller in the current context.
            if (route.controller) {
                ctx.controller = this.constructController(route.controller);
            }

            // This is a destination route.
            if (route.handler) {
                if (!ctx.controller) {
                    throw new Error('Cannot register route handler without an existing controller');
                }

                if (!ctx.controller[route.handler]) {
                    throw new Error(`${route.handler} does not exists on controller ${ctx.controller.constructor.name}`);
                }

                hapiRoutes.push({
                    method: route.method || 'get',
                    path: ctx.path,
                    handler: (req, reply) => {
                        // TODO: guards
                        const res = ctx.controller[route.handler].call(ctx.controller, req, reply);
                        if (!res) {
                            return;
                        }

                        Promise
                            .resolve(res)
                            .then(result => {
                                if (!reply._replied) {
                                    reply(result);
                                }
                            })
                            .catch(err => {
                                if (reply._replied) {
                                    return;
                                }

                                if (err.isBoom) {
                                    reply(err);
                                    return;
                                }

                                reply(Boom.badImplementation(err.message || err, err.stack));
                            });
                    },
                });
            }

            // Compile child routes.
            if (route.children) {
                hapiRoutes.push(...this.compileRoutes(route.children, ctx));
            }
        });
        return hapiRoutes;
    }

    private constructController(controllerCtor: Controller<any>): any {
        return new controllerCtor(); // TODO: dependency injection
    }
}
