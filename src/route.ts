import * as Hapi from "hapi";

export interface RuttRequest extends Hapi.Request {}

export interface RuttReply extends Hapi.ReplyNoContinue {
    _replied: boolean;
}

export interface Controller<T> extends Function {
    new (...args: any[]): T;
}

export type GuardFunction = (req: RuttRequest, reply: RuttReply) => void;

export interface Route {
    path?: string;
    children?: Route[];
    controller?: Controller<any>;
    handler?: string;
    method?: string | string[];
    guards?: GuardFunction[];
    config?: Hapi.RouteAdditionalConfigurationOptions;
    validate?: Hapi.RouteValidationConfigurationObject;
}
