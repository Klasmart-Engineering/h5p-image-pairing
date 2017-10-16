(function(ImagePair, EventDispatcher, $) {

  /**
   * Controls all the operations for each card.
   *
   * @class H5P.ImagePair.Card
   * @extends H5P.EventDispatcher
   * @param {Object} image
   * @param {number} id
   * @param {string} [description]
   */

  ImagePair.Card = function(image, id, description) {

    /** @alias H5P.ImagePair.Card# */
    var self = this;
    // Initialize event inheritance
    EventDispatcher.call(self);
    var path = H5P.getPath(image.path, id);

    /* get the image element of the current card
     * @public
     */

    self.getImage = function() {
      return self.$card.find('img').clone();
    };

    /*set a card to correct state
     * @public
     */

    self.setCorrect = function() {
      self.$top.children('.pairing-mark').addClass('pairing-correct-mark');
      self.$top.children('.h5p-pair-card-paired').addClass('h5p-pair-item-correct');
    };

    /*set a card to incorrect state
     * @public
     */

    self.setIncorrect = function() {
      self.$top.children('.pairing-mark').addClass('pairing-incorrect-mark');
      self.$top.children('.h5p-pair-card-paired').addClass('h5p-pair-item-incorrect');
    };

    /* set  card to solved state
     * @public
     */

    self.setSolved = function() {
      self.$top.children('.pairing-mark').addClass('pairing-solved-mark');
      self.$top.children('.h5p-pair-card-paired').addClass('h5p-pair-item-solved');
    };

    /* set  card to selected state
     * @public
     */



    self.setSelected = function() {
      self.$card.addClass('h5p-pair-item-selected');
    };

    /*remove  card from selected state
     * @public
     */

    self.removeSelected = function() {
      self.$card.removeClass('h5p-pair-item-selected');
    };

    /* triggerd on mate when it is paired. make its droppable propery disabled
     * @public
     */

    self.transform = function() {
      // remove droppable property
      self.$card.removeClass('h5p-pair-item-selected').droppable("option", "disabled", true);
    };

    /* triggered on card when it is paired with a mate
     * @public
     */

    self.disable = function() {
      self.$card.removeClass('h5p-pair-item-selected').addClass('h5p-pair-item-disabled');
    };

    /* triggered on mate when pairing happens
     * @public
     */

    self.pair = function(pair) {

      self.srcImage = (self.srcImage) ? self.srcImage : self.getImage();
      self.$top = self.$card;
      self.$top.html('').toggleClass('h5p-pair-images-paired', true);
      $('<span class="pairing-mark"></span>').appendTo(self.$top);
      $('<div class="h5p-pair-card-paired front"></div>').append(pair.getImage()).appendTo(self.$top);
      $('<div class="h5p-pair-card-paired"></div>').append(self.srcImage).appendTo(self.$top);
      self.$card.replaceWith(self.$top);

      //while clicking on either of the paired cards, trigger detach
      self.$top.children('.h5p-pair-card-paired').on('click', function() {
        pair.$card.removeClass('h5p-pair-item-disabled');
        self.detach();
      });

      self.$top.children('.h5p-pair-card-paired').hover(function() {
        self.$top.removeClass('h5p-pair-item-hover');
        $(this).addClass('h5p-pair-item-hover');
      }, function() {
        $(this).removeClass('h5p-pair-item-hover');
      });
    };

    /* triggerd user clicks on either of the card that is currently paired
     * @public
     */

    self.detach = function() {
      self.$card.removeClass('h5p-pair-images-paired').empty();
      $('<div class="image-container"></div>').append(self.srcImage).appendTo(self.$card);
      self.$card.removeClass('h5p-pair-item-selected').droppable("option", "disabled", false);
      self.trigger('unpair');
    };

    /**
     * Append card to the given container.
     *
     * @param {H5P.jQuery} $container
     */

    self.appendTo = function($container) {

      self.$card = $('<li class="h5p-pair-item">' +
        '<div class="image-container">' +
        '<img src="' + path + '"/>' +
        '</div>' +
        '</li>').appendTo($container);

      self.$card.click(function() {
        self.trigger('selected');
      }).end();

      self.$card.hover(function() {
        $(this).addClass('h5p-pair-item-hover');
      }, function() {
        $(this).removeClass('h5p-pair-item-hover');
      });


    };

  };

  // Extends the event dispatcher
  ImagePair.Card.prototype = Object.create(EventDispatcher.prototype);
  ImagePair.Card.prototype.constructor = ImagePair.Card;

  /**
   * Check to see if the given object corresponds with the semantics for
   * a image pair game card.
   *
   * @param {object} params
   * @returns {boolean}
   */
  ImagePair.Card.isValid = function(params) {
    return (params !== undefined &&
      params.image !== undefined &&
      params.image.path !== undefined);
  };

  /**
   * Checks to see if the card parameters should create cards with different
   * images.
   *
   * @param {object} params
   * @returns {boolean}
   */

  ImagePair.Card.hasTwoImages = function(params) {
    return (params !== undefined &&
      params.match !== undefined &&
      params.match.path !== undefined);
  };

})(H5P.ImagePair, H5P.EventDispatcher, H5P.jQuery);
