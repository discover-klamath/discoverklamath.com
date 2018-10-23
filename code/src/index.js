require('./styles/base.sass')
require('../../node_modules/slick-carousel/slick/slick.scss')
require('../../node_modules/slick-carousel/slick/slick')

import $ from 'jquery'
import { clickTouch } from './scripts/utils'
import slickMarquee from './scripts/slick_marquee'
import Klamath from './scripts/klamath'
import ads from './scripts/ads'

$(() => {
  const klamath = new Klamath()
  slickMarquee()
  initMarqueeCaptions()
  initYouTube()
  window.onYouTubeIframeAPIReady = function () { onYouTubeAPIReady() }
})

function onYouTubeAPIReady () {
  var players = []
  $('.marquee-player').each(function () {
    var iframe = $(this)
    // create each instance using the individual iframe id
    var player = new YT.Player(iframe.attr('id'))
    players.push(player)
  })

  $('.marquee').on('beforeChange', function (event, slick, currentSlide, nextSlide) {
    showCaption(nextSlide)
    // loop through each Youtube player instance and call stopVideo()
    for (var i in players) {
      var player = players[i]
      player.stopVideo()
      $('.marquee').slick('slickPlay')
    }
    // loop over .marquee-player div's and turn posterframe back on
    $('.marquee .video-wrap').each(function () {
      const imgUrl = $(this).attr('data-bg-url')
      this.style.backgroundImage = `url(${imgUrl})`
      $('.play-btn', this).css('display', 'block')
      $('.marquee-player', this).css('display', 'none')
    })
  })

  $('.marquee .video-wrap').on(clickTouch(), function (e) {
    var i, player
    this.style.backgroundImage = 'none'
    $('.play-btn', this).css('display', 'none')
    $('.marquee-player', this).css('display', 'block')
    for (i in players) {
      player = players[i]
      if (player.getVideoData()['video_id'] === $('iframe', this).attr('data-youtube-id')) {
        if (typeof window.orientation === 'undefined') {
          player.playVideo()
        }
        $('.marquee').slick('slickPause')
      }
    }
  })
}

function initYouTube () {
  // load the IFrame Player API code asynchronously
  var tag = document.createElement('script')
  var firstScriptTag
  tag.src = 'https://www.youtube.com/iframe_api'
  firstScriptTag = document.getElementsByTagName('script')[0]
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
}

function initMarqueeCaptions () {
  $('.marquee div h3').each(function () {
    $('#marquee-captions').append(`<p class="caption">${$(this).text()}</p>`)
  })
}

function showCaption (slide) {
  const $div = $('.marquee div[data-slick-index="' + slide + '"]')
  const $h3 = $('h3', $div)
  const text = $h3.text()
  $('#marquee-captions p').each(function () {
    if ($(this).text() === text) {
      $(this).addClass('vis')
    } else {
      $(this).removeClass('vis')
    }
  })
}