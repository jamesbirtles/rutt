import * as Hapi from 'hapi';
import * as Boom from 'boom';
import { cloneDeep } from 'lodash';

import { Route, Controller, RuttReply, RuttRequest } from './route';

export interface RuttOptions extends Hapi.IServerOptions {
}

export interface RuttConnectionOptions extends Hapi.IServerConnectionOptions {
}

export interface RouteContext {
    controller?: Controller<any>;
    path: string;
    params: { [key: string]: Hapi.IJoi };
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

    private compileRoutes(routes: Route[], context: RouteContext = { path: '', params: {} }) {
        const hapiRoutes = [];
        routes.forEach(route => {
            const ctx = cloneDeep(context);
            const config: any = { validate: {} };

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

            if (route.config) {
                Object.assign(config, route.config);
            }

            if (route.validate) {
                config.validate = route.validate;

                if (route.validate.params) {
                    Object.assign(ctx.params, route.validate.params);
                }
            }

            config.validate.params = Object.assign(config.validate.params || {}, ctx.params);

            // This is a destination route.
            if (route.handler) {
                if (!ctx.controller) {
                    throw new Error('Cannot register route handler without an existing controller');
                }

                if (!ctx.controller[route.handler]) {
                    throw new Error(`${route.handler} does not exists on controller ${ctx.controller.constructor.name}`);
                }

                hapiRoutes.push({
                    config,
                    method: route.method || 'get',
                    path: ctx.path,
                    handler: (req, reply) => {
                        this.runGuards(route, req, reply)
                            .then(() => {
                                return ctx.controller[route.handler].call(ctx.controller, req, reply);
                            })
                            .then(res => {
                                if (!reply._replied) {
                                    reply(res);
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

    private async runGuards(route: Route, req: RuttRequest, reply: RuttReply): Promise<void> {
        if (!route.guards) {
            return;
        }

        for (let i = 0, len = route.guards.length; i < len; i++) {
            await route.guards[i](req, reply);
            if (reply._replied) {
                return;
            }
        }
    }

    public constructController(controllerCtor: Controller<any>): any {
        return new controllerCtor();
    }
}
