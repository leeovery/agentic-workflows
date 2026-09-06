// Mint the order reference the gateway and the customer both see.
// Every reference is `ord_` followed by a ULID; nothing else assigns one.
export function mintOrderReference() {
  return `ord_${ulid()}`;
}
