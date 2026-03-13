/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    userId: string | undefined;
    userRole: string | undefined;
    userEmail: string | undefined;
    userName: string | undefined;
  }
}
