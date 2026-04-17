declare module '@slack/bolt' {
  export type App = any;
  export type SlackEventMiddlewareArgs<T = any> = any;
  export type SlackActionMiddlewareArgs<T = any> = any;
  export type SlackCommandMiddlewareArgs<T = any> = any;

  export const App: any;
  export const HTTPReceiver: any;
  export const LogLevel: any;

  const slackBolt: {
    App: any;
    HTTPReceiver: any;
    LogLevel: any;
    default?: any;
  };
  export default slackBolt;
}
