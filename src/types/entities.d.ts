declare module 'entities/decode' {
  export interface EntityDecoder {
    decode(data: string): string;
  }
  export const decodeMap: Record<string, string>;
  export const EntityDecoder: EntityDecoder;
  export default function decode(data: string): string;
}