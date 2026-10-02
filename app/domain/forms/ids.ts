import { customAlphabet } from "nanoid";

const createPublicId = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  12,
);

export function newFormPublicId(): string {
  return createPublicId();
}
