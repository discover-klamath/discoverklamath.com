export function random (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function isTouchDevice () {
  return ('ontouchstart' in window || !!(navigator.msMaxTouchPoints)) === true
}

export function clickTouch () {
  return ((isTouchDevice()) ? 'touchstart' : 'click')
}
