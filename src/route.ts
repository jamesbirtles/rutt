import * as Hapi from 'hapi';

export interface RuttRequest extends Hapi.Request {
}

export interface RuttReply extends Hapi.IReply {
    _replied: boolean;
}

export interface Controller<T> extends Function { new (...args: any[]): T; }

export type GuardFunction = (req: RuttRequest, reply: RuttReply) => void;

export interface Route {
    path?: string;
    children?: Route[];
    controller?: Controller<any>;
    handler?: string;
    method?: string | string[];
    guards?: GuardFunction[];
    config?: Hapi.IRouteAdditionalConfigurationOptions;
    validate?: {
        headers?: boolean | Hapi.IJoi | Hapi.IValidationFunction;
        params?: boolean | Hapi.IJoi | Hapi.IValidationFunction;
        query?: boolean | Hapi.IJoi | Hapi.IValidationFunction;
        payload?: boolean | Hapi.IJoi | Hapi.IValidationFunction;
        errorFields?: any;
        failAction?: string | Hapi.IRouteFailFunction;
        options?: any;
    };
}
