// Polyfill Buffer and global for Solana/Arcium browser compatibility
import { Buffer } from "buffer";
window.Buffer = window.Buffer || Buffer;
window.global = window.global || window;
