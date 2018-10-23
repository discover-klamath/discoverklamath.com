import $ from 'jquery'

export default function () {
  return $('.marquee').slick({
    autoplay: true,
    autoplaySpeed: 7000,
    fade: true,
    infinite: true,
    pauseOnHover: false,
    nextArrow: '<button class="slick-arrow slick-next">›</button>',
    prevArrow: '<button class="slick-arrow slick-prev">‹</button>'
  })
}
