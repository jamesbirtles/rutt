import { Schema as JoiValidationObject } from 'joi';
import { cloneDeepWith, isPlainObject } from 'lodash';

import * as Boom from '@hapi/boom';
import * as Hapi from '@hapi/hapi';

import { Controller, Route, RuttReply, RuttRequest } from './route';

export interface RuttOptions extends Hapi.ServerOptions {}

export interface RuttConnectionOptions extends Hapi.ServerOptions {}

export interface RouteContext {
    controller?: Record<string, Function>;
    path: string;
    params?: { [key: string]: JoiValidationObject };
}

export class Rutt {
    public server: Hapi.Server;
    protected hapiRoutes: Hapi.ServerRoute[] = [];

    constructor(options: RuttConnectionOptions) {
        this.server = new Hapi.Server(options);
    }

    public async start(): Promise<void> {
        this.hapiRoutes.forEach(route => {
            console.log(`[${route.method}] ${route.path}`);
            this.server.route(route);
        });

        return this.server.start().then(() => undefined);
    }

    public register(plugin: any): Promise<any>;
    public register(plugins: any[]): Promise<any>;
    public register(plugins: any | any[]): Promise<any> {
        return this.server.register(plugins) as Promise<any>;
    }

    public routes(routes: Route[]) {
        this.hapiRoutes = this.compileRoutes(routes);
    }

    protected compileRoutes(routes: Route[], context: RouteContext = { path: '' }) {
        const hapiRoutes: Hapi.ServerRoute[] = [];
        routes.forEach(route => {
            const ctx: RouteContext = cloneDeepWith(context, obj => {
                if (!isPlainObject(obj)) {
                    return obj;
                }
            });
            const options: Hapi.RouteOptions = { validate: {} };

            // Assemble path based on the parent routes.
            if (route.path != null) {
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

            if (route.options) {
                Object.assign(options, route.options);
            }

            if (route.validate) {
                options.validate = { ...route.validate };

                if (route.validate.params) {
                    ctx.params = Object.assign(ctx.params || {}, route.validate.params);
                }

                if (options.validate.params || ctx.params) {
                    options.validate.params = Object.assign(
                        options.validate.params || {},
                        ctx.params,
                    );
                }
            }

            // This is a destination route.
            if (route.handler) {
                if (!ctx.controller) {
                    throw new Error('Cannot register route handler without an existing controller');
                }

                if (!ctx.controller[route.handler]) {
                    throw new Error(
                        `${route.handler} does not exists on controller ${
                            ctx.controller.constructor.name
                        }`,
                    );
                }

                hapiRoutes.push({
                    options,
                    method: route.method || 'get',
                    path: ctx.path,
                    handler: async (req: Hapi.Request, reply: RuttReply) => {
                        return this.runGuards(route, req, reply)
                            .then(() => {
                                return ctx.controller![route.handler!].call(
                                    ctx.controller,
                                    req,
                                    reply,
                                );
                            })
                            .then(res => {
                                if (reply._replied) {
                                    return;
                                }

                                if (res == null) {
                                    return reply.response().code(204);
                                }

                                return res;
                            })
                            .catch(err => {
                                if (reply._replied) {
                                    return;
                                }

                                if (err.isBoom) {
                                    return err;
                                }

                                return this.handleError(err, reply);
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

    protected handleError(err: any, reply: RuttReply): Boom.Boom<any> | Hapi.ResponseObject {
        return Boom.badImplementation(err.message || err, err.stack);
    }

    protected constructController(controllerCtor: Controller<any>): any {
        return new controllerCtor();
    }
}
