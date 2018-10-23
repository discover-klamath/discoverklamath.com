import $ from 'jquery'
import { random } from './utils'

class Critters {
  constructor (props) {
    this.$critters = $('.critter')
    this.types = []
    this.sidebarLarge = ['dog', 'rabbit', 'beaver']
    this.delayInMs = 500
    this.critterCount = 0
    this.$critters.each((index) => {
      let r = this.tryForUniqueRandom()
      let $critter = $(this.$critters.get(index))
      let $innerCritter = $('div', $critter).addClass(`thing-${r}`)
      this.peekaboo($innerCritter)
    })
    // {/* this.pickRandomSidebarCritter() */}
  }

  tryForUniqueRandom () {
    let r = random(1, 8)
    if (this.types.indexOf(r) > -1) {
      return this.tryForUniqueRandom()
    } else {
      this.types.push(r)
      return r
    }
  }

  peekaboo ($critter) {
    setTimeout(() => {
      $critter.addClass('show')
      // special case for owl that needs offset
      if ($critter.hasClass('thing-3')) {
        $critter.parent().css('margin-top', '35px')
      }
    }, this.delayInMs * this.critterCount)
    this.critterCount++
  }

  pickRandomSidebarCritter () {
    let r = random(0, 2)
    let $featured = $('.newsletter-signup.featured')
    $featured.addClass(this.sidebarLarge[r])
  }
}

export const critters = new Critters()
