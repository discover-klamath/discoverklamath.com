import $ from 'jquery'
import {clickTouch, isTouchDevice} from './utils'
require('jquery-mask-plugin')

export default class Klamath {
    constructor() {
        this.touch = isTouchDevice()
        this.$header = $('header#header')
        this.$nav = $('#main-nav')
        this.navTop = this.$nav.offset().top
        $(window).on('scroll', () => {
            this.onScroll()
        })
        this.initNav()
        this.initMobileNav()
        this.setOrderGuideFieldHack()
        this.initTabLists()
        this.doSomethingAboutFirefoxAndEdge()
        this.eventSubmissionForm()
    }

    formatAMPM(date) {
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0'+minutes : minutes;
        var strTime = hours + ':' + minutes + ' ' + ampm;
        return strTime;
    }

    eventSubmissionForm() {

        $('.date').mask('00/00/0000');
        $('.phone').mask('(000) 0000-0000');

        $("#event-submission-form").on('submit', function(e) {
            e.preventDefault()

            var data = $("#event-submission-form").serialize()

            $.ajax({
                    url: '/',
                    type: 'post',
                    data: data,
                    success: function(data) {
                        console.log('success')
                        console.log(data)
                        $('#event-submission-container').fadeOut(1000, function() {
                            $('#event-submission-thanks').fadeIn(1000, function() {
                                window.href = '/things-to-do/event-calendar'
                            })
                        })
                    },
                    error: function(err) {
                        console.log('error')
                        $('#event-submission-container').fadeOut(1000, function() {
                            $('#event-submission-thanks').fadeIn(1000, function() {
                                window.location.href = '/things-to-do/event-calendar'
                            })
                        })
                    }
                }
            )
        });
    }


    onScroll() {
        let scrollTop = $(window).scrollTop()
        if ((this.navTop - scrollTop) < 0) {
            if (!$('#mobile-nav-wrap').hasClass('vis')) {
                if (window.getComputedStyle(document.getElementById('burger')).display === 'none') {
                    this.$header.addClass('fixed')
                }
            }
        } else {
            this.$header.removeClass('fixed')
        }
    }

    initNav() {
        let $topLI = $('ul#main-nav > --> li')
        $topLI.children('ul').each((index) => {
            let ul = $topLI.children('ul').get(index)
            let $link = $(ul).prev('a')
            $link.on(clickTouch(), (e) => {
                if (e.type === 'touchstart') {
                    if (!$('div', ul).hasClass('vis')) {
                        e.preventDefault()
                    }
                    this.navTouch(e.target, ul)
                }
            })
        })
    }

    navTouch(target, ul) {
        $('ul > div').removeClass('vis')
        if (target !== this.lastTouchTarget) {
            $('div', ul).addClass('vis')
        }
    }

    initMobileNav() {
        const $burgerClose = $('#burger-close')
        const $mobileNavWrap = $('#mobile-nav-wrap')
        $('#burger').on(clickTouch(), () => {
            $mobileNavWrap.addClass('vis')
            $('body').addClass('mobile-nav-open')
            $burgerClose.toggleClass('open-face')
            $burgerClose.on(clickTouch(), () => {
                $mobileNavWrap.removeClass('vis')
                $burgerClose.removeClass('open-face')
                $('body').removeClass('mobile-nav-open')
            })
        })
    }

    setOrderGuideFieldHack() {
        const form = document.getElementById('order-guide-form')
        if (form) {
            form.onsubmit = function(e) {
                var noFormErrors = true
                if (!Klamath.formVerified) {
                    e.preventDefault()
                }
                let nameDupField = document.getElementById('name-dup')
                let name = document.getElementById('name-field').value
                nameDupField.value = name
                let commentField = document.getElementById('comment-field')
                let message = document.getElementById('comment-field').value

                if (message === '') {
                    commentField.value = 'No additional comments.'
                }

                let nameField = document.getElementById('name-field')
                let emailField = document.getElementById('email-field')
                let addressField = document.getElementById('street-address1')
                let cityField = document.getElementById('city-field')
                let stateField = document.getElementById('state-field')
                let zipField = document.getElementById('zip-field')
                let reqFields = [nameField, emailField, addressField, cityField, stateField, zipField]

                function addClasses(el) {
                    let $errorLi = $(el).parent().find('ul.errors').find('li')
                    if ($(el).val() === '') {
                        $errorLi.addClass('vis')
                        noFormErrors = false
                    } else {
                        $errorLi.removeClass('vis')
                    }
                    if (noFormErrors) {
                        return true
                    }
                    return true
                }

                reqFields.forEach(addClasses)

                if (noFormErrors) {
                    this.onsubmit = null
                    this.submit()
                }
            }
        }
    }

    initTabLists() {
        $('.tab-list').each(function() {
            $('.tab-heading', this).on(clickTouch(), function(e) {
                changeTab(e)
            })

            function changeTab(e) {
                let className = e.target.getAttribute('class')
                let index = className.substr(className.indexOf('index-') + 6, 1)
                $('.tab-copy.vis').removeClass('vis')
                $('.tab-heading.active').removeClass('active')
                $('.tab-copy.index-' + index).addClass('vis')
                $('.tab-heading.index-' + index).addClass('active')
            }
        })
    }

    doSomethingAboutFirefoxAndEdge() {
        if (window.navigator.userAgent.indexOf('Firefox') > -1 || window.navigator.userAgent.indexOf('Edge') > -1) {
            $(document.documentElement).addClass('firefox-edge')

            // for now just handle one instance of image-grid
            const $gridItems = $('.row.image-grid .grid-item')
            // populate array of heights, sort and pick highest
            let offsetHeights = []

            $gridItems.each(function() {
                let workingHeight = 0
                $(this).children().each(function() {
                    workingHeight += this.offsetHeight
                })
                offsetHeights.push(workingHeight)
            })

            let tallestGrid = offsetHeights.sort(function(a, b) {
                return b - a
            })[0]
            $gridItems.each(function() {
                $(this).css('height', tallestGrid + 'px')
            })
        }
    }

}
