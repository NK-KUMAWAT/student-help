/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
  }
}

declare module "*.jpeg" {
  const value: number;
  export default value;
}
declare module "*.png" {
  const value: number;
  export default value;
}
