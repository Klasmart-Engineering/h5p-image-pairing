/*
 * This code really needs refactoring! The original authore made things quite
 * complicated, and using ES6 would be a blessing ...
 */
H5P.ImagePair = (function (EventDispatcher, $, UI) {

  /**
   * Image Pair Constructor
   * @class H5P.ImagePair
   * @extends H5P.EventDispatcher
   * @param {Object} parameters
   * @param {Number} id
   */
  function ImagePair(parameters, id, extras) {
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

    this.previousState = (extras && extras.previousState) ?
      extras.previousState :
      {};

    this.setViewState(this.previousState.viewState || 'task');

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

    this.cards = [],
    this.mates = [];

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
        self.cards.forEach(function (card) {
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
          for (var i = 0; i < self.mates.length; i++) {
            if (self.mates[i].isPaired === false) {
              self.mates[i].setFocus();
              return;
            }
          }
        }
        else {
          // select all paired mate cards
          for (let i = 0; i < self.mates.length; i++) {
            if (self.mates[i].isPaired === true) {
              // focus on the first unpaired mate found
              self.mates[i].setFocus();
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
          for (var i = 0; i < self.cards.length; i++) {
            // focus on the first unpaired card
            if (self.cards[i].isPaired === false) {
              self.cards[i].setFocus();
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
        const that = this;

        return function () {

          for (var i = 0; i < that.mates.length; i++) {
            // found the current mate
            if (that.mates[i] === mate) {
              var nextPair, fails = 0;
              do {
                fails++;
                nextPair = that.mates[i + (direction * fails)];
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
        const that = this;

        return function () {
          var list = (cardtype === 1) ? that.cards : that.mates;
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
        const that = this;

        return function () {
          var list = (cardtype === 1) ? that.cards : that.mates;
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
        const that = this;

        return function () {
          var focusSet = false;
          for (var i = 0; i < that.mates.length; i++) {
            var j = (direction === -1 ? that.mates.length - (i + 1) : i);
            if (!focusSet && that.mates[j].isPaired) {
              that.mates[j].setFocus();
              focusSet = true;
            }
            else if (that.mates[j] === mate) {
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

      mate.on('kllStoreSessionState', function () {
        self.trigger('kllStoreSessionState', undefined, { bubbles: true, external: true });
      });

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

        self.cards.forEach(function (card) {
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
      mate.on('attachPair', function (event) {
        if (mate.$top !== undefined) {
          mate.$top.empty();
        }
        mate.pair(card, event.data);
        mate.setSolved();
      });

      self.cards.push(card);
      self.mates.push(mate);
    };

    /**
     * calculate the score and mark the correct and
     * incorrect paired card
     * @private
     */
    var prepareResult = function () {
      var score = 0;
      for (var i = 0; i < self.mates.length; i++) {
        if (self.mates[i].pairingStatus === true) {
          self.mates[i].setCorrect();
          score++;
        }
        else if (self.mates[i].pairingStatus === false) {
          self.mates[i].setIncorrect();
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

      for (var i = 0; i < self.mates.length; i++) {

        // if element is already paired
        if (self.mates[i].isPaired === true) {
          //disable paired elements both front and rear
          self.mates[i].$front.removeClass('event-enabled').addClass(
            'visual-disable');
          self.mates[i].$rear.removeClass('event-enabled').addClass(
            'visual-disable');
          self.mates[i].$top.removeClass('event-enabled').addClass(
            'event-disabled');
        }
        else {
          // if it is not paired, enable it for dropping with a grey dashed border
          self.mates[i].$card.removeClass('event-disabled').addClass(
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

      for (var i = 0; i < self.mates.length; i++) {

        // if element is already paired
        if (self.mates[i].isPaired === true) {

          //enable paired elements
          self.mates[i].$front.removeClass('visual-disable').addClass(
            'event-enabled');
          self.mates[i].$rear.removeClass('visual-disable').addClass(
            'event-enabled');
          self.mates[i].$top.removeClass('grey-dash').removeClass(
            'event-enabled');

        }
        else {
          // disable unpaired elements
          self.mates[i].$card.removeClass('event-enabled').addClass(
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
      self.setViewState('solutions');

      if (self.$showSolutionButton) {
        self.$showSolutionButton.remove();
      }

      for (var i = 0; i < self.mates.length; i++) {
        //if it is incorrectly paired or not paired at all
        if (self.mates[i].pairingStatus !== true) {
          self.mates[i].trigger('attachPair', { fromShowSolutions: true });
          self.mates[i].pairingStatus = true;
        }
      }
    };

    /**
     * triggerd when user clicks the retry button
     * @public
     */
    self.retry = function () {
      self.setViewState('task');
      self.previousState = {};

      // empty the game footer
      self.$footer.empty();
      self.showCheckButton();
      for (var i = 0; i < self.mates.length; i++) {
        if (self.mates[i].isPaired === true) {
          self.mates[i].detach();
          if (self.mates[i].currentPair) {
            self.mates[i].currentPair.isPaired = false;
          }
        }
        self.cards[i].makeUntabbable();
        self.mates[i].makeUntabbable();
      }

      self.cards[0].setFocus();
      self.mates[0].makeTabbable();
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
    self.displayResult = function (params) {
      params = params || {};

      self.setViewState('results');

      var result = prepareResult();
      self.$wrapper.find('.event-enabled').removeClass('event-enabled').addClass(
        'event-disabled');
      self.$checkButton.remove();
      self.$feedbacks = $('<div class="feedback-container" />');
      var scoreText = parameters.l10n.score;
      scoreText = scoreText.replace('@score', result).replace('@total',
        self.cards.length);
      self.$feedbacks.html('<div class="feedback-text">' + scoreText +
        '</div>');
      self.$progressBar = UI.createScoreBar(self.cards.length, 'scoreBarLabel');
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
      if (result != self.cards.length) {
        self.$showSolutionButton = createButton(self.showSolution,
          'fa-eye', parameters.l10n.showSolution);
        self.$showSolutionButton.appendTo(self.$footer);
      }

      if (!params.skipXAPI) {
        var completedEvent = self.createXAPIEventTemplate('completed');
        completedEvent.setScoredResult(result, self.cards.length, self, true,
          result === self.cards.length);
        self.trigger(completedEvent);
      }

      // Emit screenshot
      setTimeout(function () {
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
        var cardTwo, cardOne = new ImagePair.Card(i, cardParams.image, id,
          cardParams.imageAlt, cardParams.audio);

        if (ImagePair.Card.hasTwoImages(cardParams)) {
          // Use matching image for card two
          cardTwo = new ImagePair.Card(i, cardParams.match, id, cardParams.matchAlt, cardParams.matchAudio);
          cardOne.hasTwoImages = cardTwo.hasTwoImages = true;
        }
        else {
          // Add two cards with the same image
          cardTwo = new ImagePair.Card(i, cardParams.image, id, cardParams.imageAlt, cardParams.audio);
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

    if (!this.previousState.cards) {
      // shuffle cards and mates array
      H5P.shuffleArray(this.cards);
      H5P.shuffleArray(this.mates);
    }
    else {
      // Restore cards' previous positions
      let cardsReordered = [];
      let matesReordered = [];

      this.previousState.cards.forEach(function (id) {
        cardsReordered.push(self.cards[id]);
      });
      this.cards = cardsReordered;

      this.previousState.mates.forEach(function (mate) {
        self.mates[mate.id].pairingStatus = mate.pairingStatus;
        matesReordered.push(self.mates[mate.id]);
      });
      this.mates = matesReordered;

      // Rebuild previous state in local storage
      this.trigger('kllStoreSessionState', undefined, { bubbles: true, external: true });
    }

    /**
     * Attach this game's html to the given container.
     *
     * @param {H5P.jQuery} $container
     */
    self.attach = function ($container) {

      if (!self.cards.length) {
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

      for (var i = 0; i < self.cards.length; i++) {
        self.cards[i].appendTo(self.$cardList);
        self.mates[i].appendTo(self.$mateList);
        self.cards[i].$card.attr("data-card", i);
        self.cards[i].$card.addClass("draggable");
        self.mates[i].$card.addClass('droppable');
        self.mates[i].$card.attr("data-mate", i);
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
            self.cards[cardId].$card.removeClass(
              'h5p-image-pair-item-hover').removeClass(
              'h5p-image-pair-item-selected').addClass(
              'h5p-image-pair-item-disabled');
            self.$cardList.find('.ui-draggable-dragging').removeClass(
              'h5p-image-pair-item-hover');
            self.prepareMateContainer();

            // Work around potential issue in jQuery
            clearTimeout(self.cards[cardId].cardBlockTimeout);
            self.cards[cardId].blocked = true;
          },
          stop: function () {
            var cardId = $(this).data('card');
            self.cards[cardId].$card.removeClass(
              'h5p-image-pair-item-disabled');
            self.reverseMateContainer();

            // Work around potential issue in jQuery
            self.cards[cardId].cardBlockTimeout = setTimeout(function () {
              self.cards[cardId].blocked = false;
            }, 100);
          }
        });

      self.$mateList.find('.droppable').droppable({
        tolerance: 'intersect',
        over: function () {
          var mateId = $(this).data('mate');
          self.mates[mateId].$card.addClass('h5p-image-pair-item-hover')
            .removeClass('grey-dash').addClass('blue-dash');
        },
        out: function () {
          var mateId = $(this).data('mate');
          self.mates[mateId].$card.removeClass(
            'h5p-image-pair-item-hover').removeClass('blue-dash')
            .addClass('grey-dash');
        },
        drop: function (event, ui) {
          var cardId = $(ui.draggable).data('card');
          var mateId = $(this).data('mate');

          self.cards.forEach(function (card) {
            card.stopAudio();
          });

          //for ensuring drag end completes before drop is triggered
          setTimeout(
            function () {
              self.cards[cardId].$card.addClass(
                'h5p-image-pair-item-disabled');
            }, 0.01);
          self.mates[mateId].pair(self.cards[cardId]);
          self.mates[mateId].trigger('checkPair', self.cards[cardId]);
          self.mates[mateId].$card
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
        self.mates[0].makeTabbable();
        self.cards[0].setFocus();
        self.$gameContainer.appendTo($container);
        self.$footer.appendTo($container);
      }

      if (self.previousState.mates) {
        self.previousState.mates.forEach(function (mate, index) {
          if (typeof mate.pairId !== 'number') {
            return;
          }

          const mateToPair = self.mates[index];
          const cardToPair = self.getById(self.cards, mate.pairId);

          mateToPair.pair(cardToPair);
          if (mateToPair.id === cardToPair.id) {
            mateToPair.pairingStatus = true;
          }
          mateToPair.transform(); //transform mate to paired status

          self.reverseMateContainer();

          cardToPair.$card.addClass('h5p-image-pair-item-disabled');
        });
      }

      if (self.previousState.viewState === 'results') {
        self.displayResult({ skipXAPI: true });
      }
      else if (self.previousState.viewState === 'solutions') {
        self.displayResult({ skipXAPI: true });
        self.showSolution();
      }
    };

    // Handle resize
    this.on('resize', function () {
      const that = this;

      if (!this.maxColumns || !that.cards.length) {
        return; // Leave sizing/wrapping to CSS flex
      }

      const cardWidthFull = that.cards[0].$card.outerWidth(true);

      if (!this.cardInitialWidth) {
        this.cardInitialWidth = that.cards[0].$card.width();
        this.cardPassepartout = cardWidthFull - this.cardInitialWidth;
      }

      // Set width to fix maxColumns cards in
      if (this.$cardList.css('max-width') === 'none') {
        this.$cardList.css('max-width', this.maxColumns * cardWidthFull + 'px');
        this.$mateList.css('max-width', this.maxColumns * cardWidthFull + 'px');

        that.cards.forEach(function (card) {
          card.$card.css('max-width', this.cardInitialWidth);
        });
        that.mates.forEach(function (card) {
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
        that.cards.forEach(function (card) {
          card.resize(cardSize);
        });
        that.mates.forEach(function (card) {
          card.resize(cardSize);
        });
      }
      else {
        that.cards.forEach(function (card) {
          card.$card.css('min-width', that.cardInitialWidth);
        });
        that.mates.forEach(function (card) {
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

  /**
   * Get card or mate by id.
   * @param {object[]} types Array of cards or mates.
   * @param {number} id Id to look for.
   * @return {object} Card or mate with id.
   */
  ImagePair.prototype.getById = function (types, id) {
    return types.find(function (type) {
      return type.id === id;
    });
  };

  /**
   * Set view state.
   * @param {string} state View state.
   */
  ImagePair.prototype.setViewState = function (state) {
    if (ImagePair.VIEW_STATES.indexOf(state) === -1) {
      return;
    }

    // Kidsloop Live session storage will listen
    this.trigger('kllStoreSessionState', undefined, { bubbles: true, external: true });

    this.viewState = state;
  };

  /**
   * Get current state.
   * @return {object} Current state.
   */
  ImagePair.prototype.getCurrentState = function () {
    return {
      cards: this.cards.map( function (card) {
        return card.id;
      }),
      mates: this.mates.map(function (mate) {
        return {
          id: mate.id,
          pairId: mate.pairId,
          pairingStatus: (mate.pairId !== undefined) ? (mate.id === mate.pairId) : undefined
        };
      }),
      viewState: this.viewState
    };
  };

  /** @constant {string[]} view state names*/
  ImagePair.VIEW_STATES = ['task', 'results', 'solutions'];

  return ImagePair;

})(H5P.EventDispatcher, H5P.jQuery, H5P.JoubelUI);
