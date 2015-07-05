"use strict";

var $ = require('jquery'),
    _ = require('underscore'),
    Backbone = require('backbone'),
    models = require('../models'),
    helpers = require('../helpers'),
    FormView = require('./FormView');

function pluckAttr(models, attribute) {
  return _.map(models, function(t) { return t.get(attribute); });
}

module.exports = FormView.extend({
  template: require('../templates/project.ejs'),

  afterInit: function() {},

  beforeRender: function() {
    if ( _.isUndefined(this.model.blueprint) && this.model.has( 'blueprint_id' ) ) {
      this.model.blueprint = new models.Blueprint(
        { id: this.model.get( 'blueprint_id' ) });
    }

    if( ! this.model.blueprint.has( 'config' ) ) {
      this.app.trigger( 'loadingStart' );
      return Promise.resolve( this.model.blueprint.fetch() );
    }
  },

  afterRender: function() {
    var view = this, promises = [];
    if ( this.model.isPublished() ) {
      var proto = window.location.protocol.replace( ':', '' ),
          embedUrl = this.model.getPublishUrl(proto) + 'embed.txt';

      promises.push( Promise
        .resolve( $.get( embedUrl ) )
        .then( function(data) {
          console.log('loaded embed');
          data = data.replace( /(?:\r\n|\r|\n)/gm, '' );
          view.$( '#embed textarea' ).text( data );
        }) );
    }

    promises.push( new Promise( function(resolve, reject) {
      view.renderForm(resolve, reject);
    } ) );

    return Promise.all(promises);
  },

  renderForm: function(resolve, reject) {
    var $form = this.$el.find('#projectForm'),
        button_tmpl = require('../templates/project_buttons.ejs'),
        form_config, config_themes;

    if ( this.model.isNew() ) {
      form_config = this.model.blueprint.get('config').form;
      config_themes = this.model.blueprint.get('config').themes || ['generic'];
    } else {
      form_config = this.model.get('blueprint_config').form;
      config_themes = this.model.get('blueprint_config').themes || ['generic'];
    }

    if(_.isUndefined(form_config)) {
      this.app.view.error('This blueprint does not have a form!');
      reject('This blueprint does not have a form!');
    } else {
      var themes = this.app.themes.filter(function(theme) {
            if ( _.isEqual(config_themes, ['generic']) ) {
              return true;
            } else {
              return _.contains(config_themes, theme.get('value'));
            }
          }),
          schema_properties = {
            "title": {
              "title": "Title",
              "type": "string",
              "required": true
            },
            "slug": {
              "title": "Slug",
              "type": "string",
              "pattern": "^[0-9a-z\-_]+$"
            },
            "theme": {
              "title": "Theme",
              "type": "string",
              "required": true,
              "default": pluckAttr(themes, 'value')[0],
              "enum": pluckAttr(themes, 'value')
            }
          },
          options_form = {
            "attributes": {
              "data-model": "Project",
              "data-model-id": this.model.isNew() ? '' : this.model.id,
              "data-action": this.model.isNew() ? 'new' : 'edit',
              "data-next": 'show'
            }
          },
          options_fields = {
            "theme": {
              "type": "select",
              "optionLabels": pluckAttr(themes, 'label')
            }
          };

      // if there is only one theme option, hide the dropdown
      if ( themes.length === 1 ) {
        options_fields['theme']['type'] = 'hidden';
      }

      _.extend(schema_properties, form_config['schema']['properties'] || {});
      if( form_config['options'] ) {
        _.extend(options_form, form_config['options']['form'] || {});
        _.extend(options_fields, form_config['options']['fields'] || {});
      }

      var opts = {
        "schema": {
          "title": this.model.blueprint.get('title'),
          "description": this.model.blueprint.get('config').description,
          "type": "object",
          "properties": schema_properties
        },
        "options": {
          "form": options_form,
          "fields": options_fields,
          "focus": this.firstRender
        },
        "postRender": _.bind(function(control) {
          this.alpaca = control;
          control.form.form.append( helpers.render(button_tmpl, this.getTemplateObj()) );
          resolve();
        }, this)
      };

      if( form_config['view'] ) {
        opts.view = form_config.view;
      }

      if(!this.model.isNew()) {
        opts.data = this.model.formData();
        if ( !_.contains(pluckAttr(themes, 'value'), opts.data.theme) ) {
          opts.data.theme = pluckAttr(themes, 'value')[0];
        }
      }
      $form.alpaca(opts);
    }
  },

  formValues: function($form) {
    var data = $form.alpaca('get').getValue();
    return {
      title: data['title'],
      slug:  data['slug'],
      theme: data['theme'],
      data:  data,
      blueprint_id: this.model.blueprint.get('id')
    };
  },

  formValidate: function(inst, $form) {
    var control = $form.alpaca('get'),
        valid = control.form.isFormValid();
    if ( !valid ) {
      control.form.refreshValidationState(true);
      $form.find('#validation-error').removeClass('hidden');
    } else {
      $form.find('#resolve-message').removeClass('hidden');
      $form.find('#validation-error').addClass('hidden');
    }
    return valid;
  },

  handleUpdateAction: function(eve) {
    var view = this,
        $btn = $(eve.currentTarget);

    return Promise.resolve( this.model.updateSnapshot() )
      .then( function(response) {
        view.app.view.success('Upgrading the project to use the newest blueprint');
      }).catch( function(error) {
        view.handleRequestError(error);
      });
  },

  handleBuildAction: function(eve) {
    var view = this,
        $btn = $(eve.currentTarget);

    return Promise.resolve( this.model.build() )
      .then(function() {
        view.app.view.success('Building project');
      }).catch(function(error) {
        view.handleRequestError( error );
      });
  },

  handleBuildAndPublishAction: function(eve) {
    var view = this,
        $btn = $(eve.currentTarget);

    return Promise.resolve( this.model.buildAndPublish() )
      .then(function() {
        view.app.view.success('Publishing project');
      }).catch(function(error) {
        view.handleRequestError(error);
      });
  }
});
