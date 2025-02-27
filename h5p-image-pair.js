H5P.ImagePair = (function (EventDispatcher, $, UI) {

  /**
   * Image Pair Constructor
   * @class H5P.ImagePair
   * @extends H5P.EventDispatcher
   * @param {Object} parameters
   * @param {Number} id
   */
  function ImagePair(parameters, id) {
    parameters = ImagePair.extend({
      cards: [],
      behaviour: {
        allowRetry: true,
        enforceColumns: false
      },
      l10n: {
        checkAnswer: 'Check',
        tryAgain: 'Retry',
        showSolution: 'Show solution',
        score: 'You got @score of @total points',
        play: 'Play',
        pause: 'Pause',
        audioNotSupported: 'Your browser does not support this audio',
        noImagesProvided: 'Someone forgot to add images.'
      }
    }, parameters);

    // Influence visual behavior
    this.maxColumns = parameters.behaviour.maxColumns || false;
    this.maxColumns = Math.min(this.maxColumns, (parameters.cards || []).length);
    this.enforceColumns = typeof parameters.behaviour.enforceColumns === 'boolean' ?
      parameters.behaviour.enforceColumns :
      true;

    // @alias H5P.ImagePair
    var self = this;
    // Initialize event inheritance
    EventDispatcher.call(self);
    var cards = [],
      mates = [];
    var clicked;

    /**
     * pushing the cards and mates to appropriate arrays and
     * defining various events on which each card should respondTo
     * @private
     * @param {H5P.ImagePair.Card} card
     * @param {H5P.ImagePair.Card} mate
     */
    var addCard = function (card, mate) {

      // Stop all audios
      card.on('stopAudios', function () {
        cards.forEach(function (card) {
          card.stopAudio();
        });
      });

      // while clicking on a card on cardList
      card.on('selected', function () {

        self.triggerXAPI('interacted');
        if (clicked === undefined) {
          card.setSelected();
          self.prepareMateContainer();
          clicked = card;
        }
        else if (clicked === card) {
          card.$card.toggleClass('h5p-image-pair-item-selected');
          self.reverseMateContainer();
          clicked = undefined;
        }
        else {
          clicked.removeSelected();
          card.setSelected();
          self.prepareMateContainer();
          clicked = card;
        }
      });

      // shifting tabbable to mateContainer
      card.on('shiftContainer', function () {
        if (card.isSelected) {
          //select all unpaired mate cards
          for (var i = 0; i < mates.length; i++) {
            if (mates[i].isPaired === false) {
              mates[i].setFocus();
              return;
            }
          }
        }
        else {
          // select all paired mate cards
          for (let i = 0; i < mates.length; i++) {
            if (mates[i].isPaired === true) {
              // focus on the first unpaired mate found
              mates[i].setFocus();
              return;
            }
          }
        }
      });
      // shifting tabbable back to card container
      mate.on('shiftContainer', function () {
        // if a card is already selected
        if (clicked) {
          clicked.setFocus();
          return;
        }
        else {
          for (var i = 0; i < cards.length; i++) {
            // focus on the first unpaired card
            if (cards[i].isPaired === false) {
              cards[i].setFocus();
              return;
            }
          }
        }
      });

      // card selected using keyboard
      card.on('makeSelection', function () {
        card.trigger('selected');
      });

      // mate selected using keyboard
      mate.on('makeSelection', function () {
        // if mate is not already paired, make it pair
        if (!mate.isPaired) {
          // for keyboard accessibility
          mate.currentPair = clicked;
          if (clicked) {
            clicked.makeUntabbable();
          }
          mate.trigger('selected');
        }
        else {
          // mate is already paired, make it unpair
          mate.currentPair.$card.removeClass(
            'h5p-image-pair-item-disabled');
          mate.detach();
          mate.currentPair.isPaired = false;
          mate.currentPair.makeTabbable();
          mate.currentPair = undefined;
        }
      });

      /**
       * Create event handler for moving focus to the next or the previous
       *  pairs on the container
       *
       * @private
       * @param {number} direction +1/-1
       * @return {function}
       */

      var createPairChangeFocusHandler = function (direction) {

        return function () {

          for (var i = 0; i < mates.length; i++) {
            // found the current mate
            if (mates[i] === mate) {
              var nextPair, fails = 0;
              do {
                fails++;
                nextPair = mates[i + (direction * fails)];
                if (!nextPair) {
                  return; // No more pairs
                }
              } while (!nextPair.isPaired);
              mate.makeUntabbable();
              nextPair.setFocus();
            }
          }
        };
      };

      /**
       * Create event handler for moving focus to the next or the previous
       *  card/mate on the container
       *
       * @private
       * @param {number} cardtype +1/-1 (card/mate)
       * @param {number} direction +1/-1
       * @return {function}
       */


      var createCardChangeFocusHandler = function (cardtype, direction) {

        return function () {
          var list = (cardtype === 1) ? cards : mates;
          var currentItem = (cardtype === 1) ? card : mate;
          for (var i = 0; i < list.length; i++) {
            if (list[i] === currentItem) {
              var nextItem, fails = 0;
              do {
                fails++;
                nextItem = list[i + (direction * fails)];
                if (!nextItem) {
                  return;
                }
              } while (nextItem.isPaired);
              currentItem.makeUntabbable();
              nextItem.setFocus();
            }
          }
        };
      };

      /**
       * Create event handler for moving focus to the first or the last card
       * on the container
       *
       * @private
       * @param {number} cardtype +1/-1 (card/mate)
       * @param {number} direction +1/-1
       * @return {function}
       */

      var createEndCardFocusHandler = function (cardtype, direction) {
        return function () {
          var list = (cardtype === 1) ? cards : mates;
          var currentItem = (cardtype === 1) ? card : mate;
          var focusSet = false;
          for (var i = 0; i < list.length; i++) {
            var j = (direction === -1 ? list.length - (i + 1) : i);
            if (!focusSet && !list[j].isPaired) {
              list[j].setFocus();
              focusSet = true;
            }
            else if (list[j] === currentItem) {
              currentItem.makeUntabbable();
            }
          }
        };
      };

      /**
       * Create event handler for moving focus to the first or the last card
       * on the table.
       *
       * @private
       * @param {number} direction +1/-1
       * @return {function}
       */
      var createEndPairFocusHandler = function (direction) {
        return function () {
          var focusSet = false;
          for (var i = 0; i < mates.length; i++) {
            var j = (direction === -1 ? mates.length - (i + 1) : i);
            if (!focusSet && mates[j].isPaired) {
              mates[j].setFocus();
              focusSet = true;
            }
            else if (mates[j] === mate) {
              mate.makeUntabbable();
            }
          }
        };
      };

      // Register handlers for moving focus to next/prev card
      card.on('next', createCardChangeFocusHandler(1, 1));
      card.on('prev', createCardChangeFocusHandler(1, -1));

      // Register handlers for moving focus to next/prev mate
      mate.on('next', createCardChangeFocusHandler(-1, 1));
      mate.on('prev', createCardChangeFocusHandler(-1, -1));

      // Register handlers for moving focus to next/prev matePair
      mate.on('nextPair', createPairChangeFocusHandler(1));
      mate.on('prevPair', createPairChangeFocusHandler(-1));

      // Register handlers for moving focus to first and last card
      card.on('first', createEndCardFocusHandler(1, 1));
      card.on('last', createEndCardFocusHandler(1, -1));

      // Register handlers for moving focus to first and last mate
      mate.on('first', createEndCardFocusHandler(-1, 1));
      mate.on('last', createEndCardFocusHandler(-1, -1));

      // Register handlers for moving focus to first and last matePair
      mate.on('firstPair', createEndPairFocusHandler(1));
      mate.on('lastPair', createEndPairFocusHandler(-1));


      // while clicking on a matecard in the mateList
      mate.on('selected', function () {

        // perform pairing
        if (clicked !== undefined) {

          // check if the clicked is the correct pair
          mate.trigger('checkPair', clicked);
          mate.pair(clicked);
          mate.transform(); //transform mate to paired status
          clicked.disable();
          clicked = undefined;
          self.reverseMateContainer();
        }

        cards.forEach(function (card) {
          card.stopAudio();
        });
      });

      // while user decides to unpair the mate with its attached pair
      mate.on('unpair', function () {
        mate.pairingStatus = undefined;
      });

      // check whether the attached card is the correct pair
      mate.on('checkPair', function (pair) {
        if (pair.data === card) {
          mate.pairingStatus = true;
        }
        else {
          mate.pairingStatus = false;
        }
      });

      // attach  mate with the clicked card
      mate.on('attachPair', function () {
        if (mate.$top !== undefined) {
          mate.$top.empty();
        }
        mate.pair(card);
        mate.setSolved();
      });
      cards.push(card);
      mates.push(mate);
    };

    /**
     * calculate the score and mark the correct and
     * incorrect paired card
     * @private
     */
    var prepareResult = function () {
      var score = 0;
      for (var i = 0; i < mates.length; i++) {
        if (mates[i].pairingStatus === true) {
          mates[i].setCorrect();
          score++;
        }
        else if (mates[i].pairingStatus === false) {
          mates[i].setIncorrect();
        }
      }
      return score;
    };

    /**
     * Generic Function to create buttons for the game
     * @private
     * @param  callback
     * @param {string} icon
     * @param {string} name
     */
    var createButton = function (callback, icon, name) {
      return UI.createButton({
        'aria-label': name,
        click: function () {
          callback();
        },
        keypress: function (event) {
          // either space / enter key activates buttons created
          if (event.which === 13 || event.which === 32) {
            event.preventDefault();
            callback();
          }
        },
        html: '<span><i class="fa ' + icon +
          '" aria-hidden="true"></i></span>&nbsp;' + name
      });
    };

    /**
     * function that defines the changes that needs to be applied on the right side
     * when a left side element is selected
     * @public
     */
    self.prepareMateContainer = function () {

      for (var i = 0; i < mates.length; i++) {

        // if element is already paired
        if (mates[i].isPaired === true) {
          //disable paired elements both front and rear
          mates[i].$front.removeClass('event-enabled').addClass(
            'visual-disable');
          mates[i].$rear.removeClass('event-enabled').addClass(
            'visual-disable');
          mates[i].$top.removeClass('event-enabled').addClass(
            'event-disabled');
        }
        else {
          // if it is not paired, enable it for dropping with a grey dashed border
          mates[i].$card.removeClass('event-disabled').addClass(
            'event-enabled').addClass('grey-dash');
        }
      }
    };

    /**
     * function that defines the changes that needs to be applied on the right side
     * after a selected element is successfully dropped
     * @public
     */
    self.reverseMateContainer = function () {

      for (var i = 0; i < mates.length; i++) {

        // if element is already paired
        if (mates[i].isPaired === true) {

          //enable paired elements
          mates[i].$front.removeClass('visual-disable').addClass(
            'event-enabled');
          mates[i].$rear.removeClass('visual-disable').addClass(
            'event-enabled');
          mates[i].$top.removeClass('grey-dash').removeClass(
            'event-enabled');

        }
        else {
          // disable unpaired elements
          mates[i].$card.removeClass('event-enabled').addClass(
            'event-disabled').removeClass('grey-dash');
        }
      }

    };


    /**
     * display the checkResult button
     * @public
     */
    self.showCheckButton = function () {
      self.$checkButton = createButton(self.displayResult, 'fa-check',
        parameters.l10n.checkAnswer);
      self.$checkButton.appendTo(self.$footer);
    };

    /**
     * triggerd when showSolution button is clicked
     * @public
     */
    self.showSolution = function () {

      self.$showSolutionButton.remove();
      for (var i = 0; i < mates.length; i++) {

        //if it is incorrectly paired or not paired at all
        if (mates[i].pairingStatus !== true) {
          mates[i].trigger('attachPair');
          mates[i].pairingStatus = true;
        }
      }
    };

    /**
     * triggerd when user clicks the retry button
     * @public
     */
    self.retry = function () {
      // empty the game footer
      self.$footer.empty();
      self.showCheckButton();
      for (var i = 0; i < mates.length; i++) {
        if (mates[i].isPaired === true) {
          mates[i].detach();
          if (mates[i].currentPair) {
            mates[i].currentPair.isPaired = false;
          }
        }
        cards[i].makeUntabbable();
        mates[i].makeUntabbable();
      }

      cards[0].setFocus();
      mates[0].makeTabbable();
      self.$footer.appendTo(self.$wrapper);
      self.$gameContainer.removeClass('event-disabled').addClass(
        'event-enabled');
      self.$wrapper.find('.h5p-image-pair-item-disabled').removeClass(
        'h5p-image-pair-item-disabled');
    };

    /**
     * triggerd when user clicks the check button
     * @public
     */
    self.displayResult = function () {

      var result = prepareResult();
      self.$wrapper.find('.event-enabled').removeClass('event-enabled').addClass(
        'event-disabled');
      self.$checkButton.remove();
      self.$feedbacks = $('<div class="feedback-container" />');
      var scoreText = parameters.l10n.score;
      scoreText = scoreText.replace('@score', result).replace('@total',
        cards.length);
      self.$feedbacks.html('<div class="feedback-text">' + scoreText +
        '</div>');
      self.$progressBar = UI.createScoreBar(cards.length, 'scoreBarLabel');
      self.$progressBar.setScore(result);
      self.$progressBar.appendTo(self.$feedbacks);
      self.$feedbacks.appendTo(self.$footer);

      if (parameters.behaviour.allowRetry) {
        //set the value if retry is enabled
        self.$retryButton = createButton(self.retry, 'fa-repeat',
          parameters.l10n.tryAgain);
        self.$retryButton.appendTo(self.$footer);
      }

      // if all cards are not correctly paired
      if (result != cards.length) {
        self.$showSolutionButton = createButton(self.showSolution,
          'fa-eye', parameters.l10n.showSolution);
        self.$showSolutionButton.appendTo(self.$footer);
      }

      var completedEvent = self.createXAPIEventTemplate('completed');
      completedEvent.setScoredResult(result, cards.length, self, true,
        result === cards.length);
      self.trigger(completedEvent);

      // Emit screenshot
      setTimeout(function() {
        if (H5P && H5P.KLScreenshot) {
          H5P.KLScreenshot.takeScreenshot(
            self,
            self.$wrapper.get(0)
          );
        }
      }, 1000); // Allow results to display

      // set focus on the first button in the footer
      self.$footer.children('button').first().focus();
      self.trigger('resize');
    };

    var cardsToUse = parameters.cards;

    // Initialize cards with the given parameters and trigger adding them
    // to proper lists
    for (var i = 0; i < cardsToUse.length; i++) {
      var cardParams = cardsToUse[i];
      if (ImagePair.Card.isValid(cardParams)) {
        // Create first card
        var cardTwo, cardOne = new ImagePair.Card(cardParams.image, id,
          cardParams.imageAlt, cardParams.audio);

        if (ImagePair.Card.hasTwoImages(cardParams)) {
          // Use matching image for card two
          cardTwo = new ImagePair.Card(cardParams.match, id, cardParams.matchAlt, cardParams.matchAudio);
          cardOne.hasTwoImages = cardTwo.hasTwoImages = true;
        }
        else {
          // Add two cards with the same image
          cardTwo = new ImagePair.Card(cardParams.image, id, cardParams.imageAlt, cardParams.audio);
        }

        cardOne.on('resize', function () {
          self.trigger('resize');
        });

        cardTwo.on('resize', function () {
          self.trigger('resize');
        });

        // Add cards to card list for shuffeling
        addCard(cardOne, cardTwo);
      }
    }

    // shuffle cards and mates array
    H5P.shuffleArray(cards);
    H5P.shuffleArray(mates);

    /**
     * Attach this game's html to the given container.
     *
     * @param {H5P.jQuery} $container
     */
    self.attach = function ($container) {

      if (!cards.length) {
        $container
          .append($('<div class="h5p-image-pair h5p-no-images-provided">')
            .html(parameters.l10n.noImagesProvided));
        return;
      }


      self.$wrapper = $container.addClass('h5p-image-pair').html('');
      const $descWrapper = $('<div class="h5p-image-pair-desc-wrapper">').appendTo($container);

      // Add audio button functionality
      const hasAudio = (parameters.taskDescriptionAudio && parameters.taskDescriptionAudio.length > 0);

      // Audio Button
      if (hasAudio) {
        const $audioButtonContainer = $('<div/>', {
          'class': 'h5p-image-pair-desc-audio-wrapper'
        });

        const audioInstance = new H5P.Audio(
          {
            files: parameters.taskDescriptionAudio,
            audioNotSupported: parameters.l10n.audioNotSupported
          },
          id
        );
        audioInstance.attach($audioButtonContainer);
        $audioButtonContainer.appendTo($descWrapper);
      }

      const $desc = $('<div class="h5p-image-pair-desc">' + parameters.taskDescription +
        '</div>').appendTo($descWrapper).focus();
      if (hasAudio) {
        $desc.addClass('hasAudio');
      }

      self.$gameContainer = $(
        '<div class="game-container event-enabled"/>');

      const $cardListWrapper = $('<div class="card-container-wrapper" />');
      const $mateListWrapper = $('<div class="mate-container-wrapper" />');
      self.$cardList = $('<ul class="card-container" />');
      self.$mateList = $('<ul class="mate-container"/>');
      self.$footer = $('<div class="footer-container"/>');

      self.$checkButton = createButton(self.displayResult, 'fa-check',
        parameters.l10n.checkAnswer);
      self.$checkButton.appendTo(self.$footer);

      for (var i = 0; i < cards.length; i++) {
        cards[i].appendTo(self.$cardList);
        mates[i].appendTo(self.$mateList);
        cards[i].$card.attr("data-card", i);
        cards[i].$card.addClass("draggable");
        mates[i].$card.addClass('droppable');
        mates[i].$card.attr("data-mate", i);
      }

      self.$cardList.find('.draggable').draggable(

        {
          opacity: 0.7,
          helper: "clone",
          handle: "div",
          revert: 'invalid',
          start: function () {
            self.triggerXAPI('interacted');
            var cardId = $(this).data('card');
            cards[cardId].$card.removeClass(
              'h5p-image-pair-item-hover').removeClass(
              'h5p-image-pair-item-selected').addClass(
              'h5p-image-pair-item-disabled');
            self.$cardList.find('.ui-draggable-dragging').removeClass(
              'h5p-image-pair-item-hover');
            self.prepareMateContainer();

            // Work around potential issue in jQuery
            clearTimeout(cards[cardId].cardBlockTimeout);
            cards[cardId].blocked = true;
          },
          stop: function () {
            var cardId = $(this).data('card');
            cards[cardId].$card.removeClass(
              'h5p-image-pair-item-disabled');
            self.reverseMateContainer();

            // Work around potential issue in jQuery
            cards[cardId].cardBlockTimeout = setTimeout(function () {
              cards[cardId].blocked = false;
            }, 100);
          }
        });

      self.$mateList.find('.droppable').droppable({
        tolerance: 'intersect',
        over: function () {
          var mateId = $(this).data('mate');
          mates[mateId].$card.addClass('h5p-image-pair-item-hover')
            .removeClass('grey-dash').addClass('blue-dash');
        },
        out: function () {
          var mateId = $(this).data('mate');
          mates[mateId].$card.removeClass(
            'h5p-image-pair-item-hover').removeClass('blue-dash')
            .addClass('grey-dash');
        },
        drop: function (event, ui) {
          var cardId = $(ui.draggable).data('card');
          var mateId = $(this).data('mate');

          cards.forEach(function (card) {
            card.stopAudio();
          });

          //for ensuring drag end completes before drop is triggered
          setTimeout(
            function () {
              cards[cardId].$card.addClass(
                'h5p-image-pair-item-disabled');
            }, 0.01);
          mates[mateId].pair(cards[cardId]);
          mates[mateId].trigger('checkPair', cards[cardId]);
          mates[mateId].$card
            .removeClass('h5p-image-pair-item-hover')
            .removeClass('droppable')
            .removeClass('blue-dash').droppable("option",
              "disabled", true);
        }
      });

      if (self.$cardList.children().length >= 0) {

        self.$cardList.appendTo($cardListWrapper);
        $cardListWrapper.appendTo(self.$gameContainer);
        self.$mateList.appendTo($mateListWrapper);
        $mateListWrapper.appendTo(self.$gameContainer);
        mates[0].makeTabbable();
        cards[0].setFocus();
        self.$gameContainer.appendTo($container);
        self.$footer.appendTo($container);
      }
    };

    // Handle resize
    this.on('resize', function () {
      const that = this;

      if (!this.maxColumns || !cards.length) {
        return; // Leave sizing/wrapping to CSS flex
      }

      const cardWidthFull = cards[0].$card.outerWidth(true);

      if (!this.cardInitialWidth) {
        this.cardInitialWidth = cards[0].$card.width();
        this.cardPassepartout = cardWidthFull - this.cardInitialWidth;
      }

      // Set width to fix maxColumns cards in
      if (this.$cardList.css('max-width') === 'none') {
        this.$cardList.css('max-width', this.maxColumns * cardWidthFull + 'px');
        this.$mateList.css('max-width', this.maxColumns * cardWidthFull + 'px');

        cards.forEach(function (card) {
          card.$card.css('max-width', this.cardInitialWidth);
        });
        mates.forEach(function (card) {
          card.$card.css('max-width', this.cardInitialWidth);
        });

        // that.$list.width() is not correct yet
        setTimeout(function () {
          that.trigger('resize');
        }, 50);
      }

      // Scale cards in order to keep column layout
      if (parameters.behaviour.enforceColumns) {
        const cardSize = Math.floor((that.$cardList.width() - this.maxColumns * this.cardPassepartout) / this.maxColumns) - 2;
        cards.forEach(function (card) {
          card.resize(cardSize);
        });
        mates.forEach(function (card) {
          card.resize(cardSize);
        });
      }
      else {
        cards.forEach(function (card) {
          card.$card.css('min-width', that.cardInitialWidth);
        });
        mates.forEach(function (card) {
          card.$card.css('min-width', that.cardInitialWidth);
        });
      }
    });
  }


  /**
   * Extend an array just like JQuery's extend.
   * @param {object} arguments Objects to be merged.
   * @return {object} Merged objects.
   */
  ImagePair.extend = function () {
    for (let i = 1; i < arguments.length; i++) {
      for (let key in arguments[i]) {
        if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
          if (typeof arguments[0][key] === 'object' && typeof arguments[i][key] === 'object') {
            this.extend(arguments[0][key], arguments[i][key]);
          }
          else {
            arguments[0][key] = arguments[i][key];
          }
        }
      }
    }
    return arguments[0];
  };

  // Extends the event dispatcher
  ImagePair.prototype = Object.create(EventDispatcher.prototype);
  ImagePair.prototype.constructor = ImagePair;

  return ImagePair;

})(H5P.EventDispatcher, H5P.jQuery, H5P.JoubelUI);
