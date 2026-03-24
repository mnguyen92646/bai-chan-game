"use client";

const KEY_PREFIX = "bai-chan-token:";

export function getToken(roomId: string) {
  return window.localStorage.getItem(`${KEY_PREFIX}${roomId}`) ?? "";
}

export function setToken(roomId: string, token: string) {
  window.localStorage.setItem(`${KEY_PREFIX}${roomId}`, token);
}
