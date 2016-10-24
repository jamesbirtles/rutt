export interface Controller<T> extends Function { new (...args: any[]): T; }

export type GuardFunction = () => void;

export interface Route {
    path?: string;
    children?: Route[];
    controller?: Controller<any>;
    handler?: string;
    method?: string | string[];
    guards?: GuardFunction[];
}
