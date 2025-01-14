console.info(
    '%c GAUGE-CARD %c 0.2.5 ',
    'color: cyan; background: black; font-weight: bold;',
    'color: darkblue; background: white; font-weight: bold;',
);

class GaugeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  setConfig(config) {
    if (!config.entity) {
      throw new Error('Please define an entity');
    }

    const root = this.shadowRoot;
    if (root.lastChild) root.removeChild(root.lastChild);

    const cardConfig = Object.assign({}, config);
    if (!cardConfig.scale) cardConfig.scale = "50px";
    if (!cardConfig.min) cardConfig.min = 0;
    if (!cardConfig.max) cardConfig.max = 100;
    if (!cardConfig.needle) cardConfig.needle = false;

    const entityParts = this._splitEntityAndAttribute(cardConfig.entity);
    cardConfig.entity = entityParts.entity;
    if (entityParts.attribute) cardConfig.attribute = entityParts.attribute;

    const card = document.createElement('ha-card');
    const content = document.createElement('div');
    const style = document.createElement('style');
    style.textContent = `
      ha-card {
        --base-unit: ${cardConfig.scale};
        height: calc(var(--base-unit)*3);
        position: relative;
      }
      .container{
        width: calc(var(--base-unit) * 4);
        height: calc(var(--base-unit) * 2);
        position: absolute;
        top: calc(var(--base-unit)*1.5);
        left: 50%;
        overflow: hidden;
        text-align: center;
        transform: translate(-50%, -50%);
      }
      .gauge-a{
        z-index: 1;
        position: absolute;
        background-color: var(--primary-background-color);
        width: calc(var(--base-unit) * 4);
        height: calc(var(--base-unit) * 2);
        top: 0%;
        border-radius:calc(var(--base-unit) * 2.5) calc(var(--base-unit) * 2.5) 0px 0px ;
      }
      .gauge-b{
        z-index: 3;
        position: absolute;
        background-color: var(--paper-card-background-color);
        width: calc(var(--base-unit) * 2.5);
        height: calc(var(--base-unit) * 1.25);
        top: calc(var(--base-unit) * 0.75);
        margin-left: calc(var(--base-unit) * 0.75);
        margin-right: auto;
        border-radius: calc(var(--base-unit) * 2.5) calc(var(--base-unit) * 2.5) 0px 0px ;
      }
      .gauge-c{
        z-index: 2;
        position: absolute;
        background-color: var(--warning-color);
        width: calc(var(--base-unit) * 4);
        height: calc(var(--base-unit) * 2);
        top: calc(var(--base-unit) * 2);
        margin-left: auto;
        margin-right: auto;
        border-radius: 0px 0px calc(var(--base-unit) * 2) calc(var(--base-unit) * 2) ;
        transform-origin: center top;
        transition: all 1.3s ease-in-out;
      }
      .gauge-data{
        z-index: 4;
        color: var(--primary-text-color);
        line-height: calc(var(--base-unit) * 0.3);
        position: absolute;
        width: calc(var(--base-unit) * 4);
        height: calc(var(--base-unit) * 2.1);
        top: calc(var(--base-unit) * 1.2);
        margin-left: auto;
        margin-right: auto;
        transition: all 1s ease-out;
      }
      #gauge-data-val{
        width: calc(var(--base-unit) * 1.6);
        line-height: calc(var(--base-unit) * 0.5);
        margin-left: auto;
        margin-right: auto;
      }
      .gauge-data #val{
        font-size: calc(var(--base-unit) * 0.55);
        width: 50%;
        float: left;
      }
      .gauge-data #unit{
        font-size: calc(var(--base-unit) * 0.40);
        width: 50%;
        float: left;
      }
      .gauge-data #title{
        padding-top: calc(var(--base-unit) * 0.15);
        font-size: calc(var(--base-unit) * 0.30);
      }
    `;
    content.innerHTML = `
      <div class="container">
        <div class="gauge-a"></div>
        <div class="gauge-b"></div>
        <div class="gauge-c" id="gauge"></div>
        <div class="gauge-data"><div id="gauge-data-val"><div id="val"></div><div id="unit"></div></div></div>
        <div id="title"></div>
      </div>
    `;
    card.appendChild(content);
    card.appendChild(style);
    card.addEventListener('click', event => {
      this._fire('hass-more-info', { entityId: cardConfig.entity });
    });
    root.appendChild(card);
    this._config = cardConfig;
  }

  _splitEntityAndAttribute(entity) {
      let parts = entity.split('.');
      if (parts.length < 3) {
          return { entity: entity };
      }

      return { attribute: parts.pop(), entity: parts.join('.') };
  }

  _fire(type, detail, options) {
    const node = this.shadowRoot;
    options = options || {};
    detail = (detail === null || detail === undefined) ? {} : detail;
    const event = new Event(type, {
      bubbles: options.bubbles === undefined ? true : options.bubbles,
      cancelable: Boolean(options.cancelable),
      composed: options.composed === undefined ? true : options.composed
    });
    event.detail = detail;
    node.dispatchEvent(event);
    return event;
  }

  _translateTurn(value, config) {
    return 5 * (value - config.min) / (config.max - config.min)
  }

  _computeSeverity(stateValue, sections) {
    let numberValue = Number(stateValue);
    const severityMap = {
      red: "var(--error-color)",
      green: "var(--success-color)",
      yellow: "var(--warning-color)",
      normal: "var(--info-color)",
    }
    if (!sections) return severityMap["normal"];
    let sortable = [];
    for (let severity in sections) {
      sortable.push([severity, sections[severity]]);
    }
    sortable.sort((a, b) => { return a[1] - b[1] });

    if (numberValue >= sortable[0][1] && numberValue < sortable[1][1]) {
      return severityMap[sortable[0][0]]
    }
    if (numberValue >= sortable[1][1] && numberValue < sortable[2][1]) {
      return severityMap[sortable[1][0]]
    }
    if (numberValue >= sortable[2][1]) {
      return severityMap[sortable[2][0]]
    }
    return severityMap["normal"];
  }

  _getEntityStateValue(entity, attribute) {
    if (!attribute) {
      return entity.state;
    }

    return entity.attributes[attribute];
  }

  set hass(hass) {
    const config = this._config;
    const entityState = this._getEntityStateValue(hass.states[config.entity], config.attribute);
    let measurement = "";
    if (config.measurement == null)
      measurement = hass.states[config.entity].attributes.unit_of_measurement;
    else
      measurement = config.measurement;

    const root = this.shadowRoot;
    if (entityState !== this._entityState) {
      root.getElementById("val").textContent = `${entityState}`;
      root.getElementById("unit").textContent = ` ${measurement}`;
      root.getElementById("title").textContent = config.title;
      const turn = this._translateTurn(entityState, config) / 10;
      root.getElementById("gauge").style.transform = `rotate(${turn}turn)`;
      root.getElementById("gauge").style.backgroundColor = this._computeSeverity(entityState, config.severity);
      this._entityState = entityState;
    }
    root.lastChild.hass = hass;
  }

  getCardSize() {
    return 1;
  }
}

customElements.define('gauge-card', GaugeCard);
