"use strict";

var $ = require('jquery'),
    _ = require('underscore'),
    Backbone = require('backbone'),
    models = require('../models'),
    FormView = require('./FormView');

module.exports = FormView.extend({
  template: require('../templates/blueprint_list.ejs'),
  handleUpdateAction: function(eve) {
    var $btn = $(eve.currentTarget),
    model_class = $btn.data('model'),
    model_id = $btn.data('model-id'),
    inst = new models[model_class]({id: model_id});

    Backbone.ajax({
      type: 'GET',
      url: inst.url() + '/update_repo'
    })
    .done(_.bind(function() {
      this.success('Updating blueprint repo');
      inst.fetch();
    }, this))
    .fail(_.bind(this.handleRequestError, this));
  }
});