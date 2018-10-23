$('.ad').click((e) => {
  var target = e.target;
  var slug = target.getAttribute('data-slug');
  ga('send', 'event', 'ad-click', 'click', slug)
})