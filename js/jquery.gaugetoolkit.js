(function($) {
  function Instrument(placeholder, options) {
    // Initialise settings
    var settings  = $.extend(true, {
      class       : 'instrument',
      size        : 200,
      registers   : [ { } ],
      gauges      : [ { } ],
      renderSvg   : $.GT.renderSvg,
      renderBase  : $.GT.renderBox,
      renderFace  : $.GT.renderGaugeBackground,
      renderTop   : $.GT.renderBezel,
      labels      : null
    }, options);
    
    if(settings.registers) {
      settings.registers.forEach(function(register,i,a) {
        register = settings.registers[i] = $.extend({
          setFuncName      : 'setValue',
          getFuncName      : 'getValue',
          minValue         : 0, 
          maxValue         : 100,
          inputConversion  : function(val) { return val; },
          outputConversion : function(val) { return val; }
        }, register);
        
        if(typeof register.value === 'undefined') register.value = register.minValue;
        register.parent      = settings;
        register.initialized = false;
      });
    }
    
    if(settings.gauges) {
      settings.gauges.forEach(function(gauge,i) {
        gauge = settings.gauges[i] = $.extend(true, {
          visible         : true,
          clockwise       : true,
          classname       : 'gauge',
          renderBase      : undefined, 
          renderIndicator : $.GT.renderNeedle, 
          renderTop       : undefined,
          movementStart   : undefined,
          movementRange   : 120,
          scale           : 1,
          offset          : { x:0, y:0 },
          rotate          : 0,
          ranges          : [],
          labels          : [],
          scales           : [],
          registers       : [0],
          mechanics       : $.GT.radialGaugeMechanics,
          showFuncName    : undefined,
        }, gauge);
        
        gauge.parent     = settings;
        
        if(gauge.ranges) {
          gauge.ranges.forEach(function(range,i) {
            range = gauge.ranges[i] = $.extend({
              class:     'range',
              extent     : -4,
              offset     : 134,
              scales      : [ ],
              render     : $.GT.renderRadialRange
            }, range);
            
            range.parent = gauge;

            if(range.scales) {
              range.scales.forEach(function(scale, i) {
                scale = range.scales[i] = $.extend({
                  class  : 'scale scale-level-' + i,
                  divisions  : 5,
                  offset : 0,
                  extent : -20
                }, scale);
                
                scale.parent = range;
                
                if(scale.label) {
                  scale.label = $.extend({
                    class            : 'label scale-label',
                    offset           : -44,
                    formatFunction   : function(val) { return val; },
                    render           : $.GT.renderLabel,
                  }, scale.label);
                }
              });
            }
          });
        }
        
        if(gauge.labels) {
          gauge.labels.forEach(function(label,i) {
            label = gauge.labels[i] = $.extend({
              class            : 'label',
              render           : $.GT.renderLabel,  
            }, label);
            
            label.parent = gauge;
          });
        }
      });
    }
    
    var registers = [];
    var instrumentObject = {};
    
    // Initialise registers
    settings.registers.forEach(function(register) {
      var listeners = [];
      register.addListener = function(listener) {
        listeners.push(listener);
      };
      
      register.getValue = function() {
        return this.outputConversion(this.value);
      };
      
      register.setValue = function(val) {
        val = this.inputConversion(val);
        if(val < this.minValue)
          val = this.minValue;
        else if(val > this.maxValue)
          val = this.maxValue;
        
        if (this.initialized == false || val != this.value) {
          this.value       = val;
          this.initialized = true;
          listeners.forEach(function(l) {
            try { l(val); }
            catch(e) {
              console.error(e);
            }
          });
        }
        
        return val;
      };
      
      registers.push(register);
      
      instrumentObject[register.setFuncName] = function(val) { return register.setValue(val); };
      instrumentObject[register.getFuncName] = function(val) { return register.getValue(val); };
    });
    
    // Initialise SVG
    var svg = settings.renderSvg();
    svg.setAttribute('class', settings.class);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 ' + constants.cx + ' ' + constants.cy);
    
    if(settings.renderBase)
      settings.renderBase(svg);
    if(settings.renderFace)
      settings.renderFace(svg);
    
    // Render gauges
    settings.gauges.forEach(function(gauge) {
      gauge.registers   = registers.filter(function(v,i,a) { return gauge.registers.some(function(r) { return (r == i || r == v.name) }) });
      gauge.indicatorId = 'indicator-id-' + Date.now();
      if(gauge.movementStart === undefined) gauge.movementStart = 90 - (gauge.movementRange / 2);
      if(gauge.registers) gauge.degreesPerValue = (gauge.modulo) ? 
        gauge.movementRange / gauge.modulo : 
        gauge.movementRange / (gauge.registers[0].maxValue - gauge.registers[0].minValue);
      if(gauge.showFuncName) 
        instrumentObject[gauge.showFuncName] = function(show) { if(show === false) g.setAttribute('display', 'none'); else g.removeAttribute('display'); };
      
      gauge.ranges.forEach(function(range) { 
        if(range.fromValue === undefined) range.fromValue = gauge.registers[0].minValue;
        if(range.toValue === undefined) range.toValue = gauge.registers[0].maxValue;
      });
        
      var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", gauge.classname);
      
      if(gauge.visible == false)
        g.setAttribute('display', 'none');
      if(gauge.renderBase)
        gauge.renderBase(g);
      
      gauge.ranges.forEach(function(range) { range.render(g); });
      gauge.labels.forEach(function(label,i,a) { label.render(g); });

      if(gauge.renderIndicator) 
        gauge.renderIndicator(g);
      if(gauge.renderTop)
        gauge.renderTop(g);
      
      var transform = '';
      if(gauge.scale && gauge.scale != 1) {
        gauge.offset.x += (constants.cx - (constants.cx * gauge.scale)) / 2;
        gauge.offset.y += (constants.cy - (constants.cy * gauge.scale)) / 2;
      }
      if(gauge.offset && (gauge.offset.x != 0 || gauge.offset.y != 0))
        transform += 'translate(' + gauge.offset.x + ' ' + gauge.offset.y + ') ';
      if(gauge.rotate)
        transform += 'rotate(' + gauge.rotate + ' 200 200) ';
      if(gauge.scale && gauge.scale != 1)
        transform += 'scale(' + gauge.scale + ' ' + gauge.scale + ') ';
      if(transform != '')
        g.setAttribute('transform', transform.trim());
      
      gauge.mechanics(gauge, g);
      
      svg.appendChild(g);
    });
    
    if(settings.renderTop)
      settings.renderTop(svg);
    
    var div = $(document.createElement("div"));
    div.addClass('instrument');
    div.css({height : settings.size, width: settings.size});
    div.append(svg);
    
    // Set initial register value
    registers.forEach(function(register) {
      register.setValue(register.value);
    });
    
    // Insert SVG graphic into the DOM
    placeholder.append(div);

    return instrumentObject;
  }

  $.GT = {
    renderSvg : function() {
      var svg = elem('svg');
      var defs = elem('defs', null, svg);
      
      var filter = elem('filter', { id: 'GaugeShadow', filterUnits: 'objectBoundingBox' }, defs);
      var fgb    = elem('feGaussianBlur', { stdDeviation: 5, result: 'blur', 'in': 'SourceAlpha' }, filter);
      var fo     = elem('feOffset', { dx: 0, dy: 0, result: 'offsetBlurredAlpha', 'in': 'blur' }, filter);
      var fm     = elem('feMerge', null, filter);
      var fmn1   = elem('feMergeNode', { 'in': 'offsetBlurredAlpha' }, fm);
      var fmn2   = elem('feMergeNode', { 'in': 'SourceGraphic' }, fm);
      
      return svg;
    },
    renderBox : function (container) {
      var g     = elem('g', { class: 'instrument-box' }, container);
      var path1 = elem('path', { class: 'instrument-box', d: 'M387.667,375c0,6.627-5.373,12-12,12h-350c-6.627,0-12-5.373-12-12V25c0-6.627,5.373-12,12-12h350c6.627,0,12,5.373,12,12V375z' }, g); 
    },
    renderBezel : function(container) {
      var g     = elem('g', { class: 'bezel' }, container);
      var path  = elem('path', { class: 'bezel', d: 'M200.333,33.5c-91.956,0-166.5,74.544-166.5,166.5s74.544,166.5,166.5,166.5c91.957,0,166.5-74.544,166.5-166.5S292.29,33.5,200.333,33.5z M200.667,350.099c-82.714,0-149.767-67.053-149.767-149.767c0-82.713,67.053-149.767,149.767-149.767s149.767,67.053,149.767,149.767C350.433,283.046,283.38,350.099,200.667,350.099z' }, g);
    },
    renderGaugeBackground : function(container) {
      var g     = elem('g', { class: 'instrument-face' }, container);
      var path  = elem('path', { class: 'instrument-face', d: 'M200.333,47c-84.497,0-153,68.503-153,153s68.503,153,153,153s153-68.503,153-153S284.831,47,200.333,47z' }, g);
    },
    renderNeedle : function(container) {
      var g     = elem('g', { class: 'needle needle-standard', id: this.indicatorId }, container);
      var poly  = elem('polygon', { class: 'needle', points: '76.445,196.417 68.082,200 76.423,203.583 184.334,203.583 184.334,196.417' }, g);
      var path  = elem('path', { class: 'needle-hub', d: 'M239.042,196.417c-3.563-3.563-8.918,0-13.063,0c-0.787,0-3.148,0-3.148,0h-11.969c-1.51-4.271-5.573-7.337-10.362-7.337s-8.852,3.065-10.362,7.337h-5.804v7.167h5.745c1.464,4.355,5.572,7.496,10.42,7.496s8.956-3.141,10.42-7.496h12.036c0,0,2.314,0,3.085,0c3.874,0,9.458,3.542,13,0C241.124,201.501,241.25,198.625,239.042,196.417z'}, g);
    },
    renderSmallNeedle : function(container) {
      var g     = elem('g', { class: 'needle needle-small', id: this.indicatorId }, container);
      var poly  = elem('polygon', { class: 'needle', transform: 'rotate(-90 200 200)', points: '211.838,160.802 200.343,132.368 200.338,132.386 200.333,132.368 188.838,160.802 200.333,207 200.338,206.977 200.343,207' }, g);
      var path  = elem('path', { class: 'needle-hub', transform: 'rotate(-90 200 200)', d: 'M200.331,196.091c0,0-9.492,18.192-9.331,24.818c0.062,2.56,1.828,4.228,9.331,4.228s9.114-1.709,9.146-4.228c0.083-6.507-8.809-24.493-8.809-24.493'}, g);
    },
    renderSmallReverseNeedle : function(container) {
      var g     = elem('g', { class: 'needle needle-small-reverse', id: this.indicatorId }, container);
      var poly  = elem('polygon', { class: 'needle', points: '59.719,196.417 68.082,200 59.719,203.583 52.719,203.583 52.719,196.417' }, g);
    },
    renderCompassRose : function(container) {
      var g  = elem('g', { id:this.indicatorId }, container);
      
      var p1 = elem('path', { d: 'M50,200A150,150 0 0,1 350,200A150,150 0 1,1 50,200' });
      var p2 = elem('path', { d: 'M65,200A120,120 0 0,1 335,200A120,120 0 1,1 65,200' });
      var p3 = elem('path', { d: 'M70,200A110,110 0 0,1 330,200A110,110 0 1,1 70,200' });
      var p4 = elem('path', { d: 'M90,200A90,90 0 0,1 310,200A90,90 0 1,1 90,200' });
      
      var f1 = p1.getTotalLength() / 360;
      var f2 = p2.getTotalLength() / 360;
      var f3 = p3.getTotalLength() / 360;
      var f4 = p4.getTotalLength() / 360;
      
      for(var i=0;i<360;i+=5) {
        var pt1 = p1.getPointAtLength(f1 * i);
        var pt2 = (i % 10 == 0) ? p3.getPointAtLength(f3 * i) : p2.getPointAtLength(f2 * i);
        var e   = elem('line', { class: 'heading-lines', x1: pt1.x, y1: pt1.y, x2: pt2.x, y2: pt2.y }, g);
        
        if(i % 30 == 0) {
          var k = ((i + 270) % 360);
          var l = '';
          switch(i) {
            case 0:
              l = 'W';
              break;
            case 90:
              l = 'N';
              e.setAttribute('class', 'heading-lines heading-lines-n');
              break;
            case 180:
              l = 'E';
              break;
            case 270:
              l = 'S';
              break;
            default:
              l = k / 10;
          }
          
          var pt = p4.getPointAtLength(f4 * i);
          elem('text', { class: 'label heading-degrees', x: pt.x, y: pt.y, transform: 'rotate(' + k + ' ' + pt.x + ',' + pt.y + ')' }, g, l);
        }
      }
    },
    renderHeadingMarkings : function(container) {
      var g = elem('g', { class: 'heading-markings' }, container);
      elem('path', { class: 'heading-aircraft', d: 'M200.38,81.417c0,0-7.042,11.625-11.292,24.75s-7.125,51.375-7.125,51.375l-54.213,39.3c0,0-13.543,8.502-16.3,15.598c-0.958,2.468-1.491,5.852-1.612,7.852c-0.222,3.681,0,13.749,0,13.75c0.125,2.125,1.5,3.875,6,2.375s69.5-23.125,69.5-23.125l2.75,54.25c0,0-16.723,12.949-21.875,17.75c-1.232,1.148-3.054,2.765-4.063,4.875c-1.045,2.187-1.161,5.537-1.188,7.25c-0.038,2.437-0.131,8.147,0.188,9.063c0.5,1.438,1.063,1.918,3.135,1.918c2.625,0,12.928-5.73,12.928-5.73l18.75-9.25l4.333,12.25l-4.333-12.25l4.333,12.25h0.168l4.333-12.25l18.75,9.25c0,0,10.303,5.73,12.928,5.73c2.072,0,2.635-0.48,3.135-1.918c0.318-0.916,0.226-6.625,0.188-9.063c-0.027-1.713-0.143-5.063-1.188-7.25c-1.008-2.11-2.83-3.727-4.063-4.875c-5.152-4.801-21.875-17.75-21.875-17.75l2.75-54.25c0,0,65,21.625,69.5,23.125s5.875-0.25,6-2.375c0-0.001,0.222-10.069,0-13.75c-0.121-2-0.653-5.384-1.612-7.852c-2.756-7.096-16.3-15.598-16.3-15.598l-54.213-39.3c0,0-2.875-38.25-7.125-51.375S200.38,81.417,200.38,81.417V61' }, g);
      elem('polygon', { class: 'heading-arrows-cardinal', points: '200.381,332.311 194.542,344.439 206.542,344.439' }, g);
      elem('polygon', { class: 'heading-arrows-cardinal', points: '68.291,200.382 56.291,194.604 56.291,206.477' }, g);
      elem('polygon', { class: 'heading-arrows-cardinal', points: '332.311,200.285 344.44,206.125 344.441,194.125' }, g);
      elem('polygon', { class: 'heading-arrows-cardinal', points: '200.619,68.022 206.458,55.893 194.458,55.892' }, g);
      elem('polygon', { class: 'heading-arrows-secondary', points: '294.272,294.239 298.743,307.01 307.272,298.481' }, g);
      elem('polygon', { class: 'heading-arrows-secondary', points: '105.938,294.771 94.146,298.898 102.02,306.771' }, g);
      elem('polygon', { class: 'heading-arrows-secondary', points: '106.001,106.041 101.801,94.041 93.787,102.055' }, g);
      elem('polygon', { class: 'heading-arrows-secondary', points: '294.731,105.894 306.519,101.767 298.646,93.894' }, g);
    },
    renderBeaconOne : function(container) {
      var g = elem('g', { id: this.indicatorId, class: 'heading-beacon-one' }, container);
      elem('path', { class: 'heading-beacon-one-marker', d: 'm 198,200 0,-110 -4,0 6.5,-18 6,18 -4,0 0,238 -4.5,0 z' }, g);
    },
    renderBeaconTwo : function(container) {
      var g = elem('g', { id: this.indicatorId, class: 'heading-beacon-two' }, container);
      elem('rect', { class: 'heading-beacon-two-marker', x: 195, y: 120, width: 10, height: 150 }, g);
      elem('polygon', { class: 'heading-beacon-two-marker', points: '190,120 200,80 210,120' }, g);
      elem('line', { class: 'heading-beacon-two-marker', x1: 200, y1: 270, x2: 200, y2: 325 }, g);
    },
    renderVarioFace : function(container) {
      elem('path', { class: 'scale scale-level-1', d: 'M337.011,178.353c0,0,3,8.314,3,21.98c0,13.167-3,21.315-3,21.315' }, container);
      elem('path', { class: 'scale scale-level-1', d: 'M121.417,181.292h-36.25c0,0,0.342-4.491,2.306-11.307c1.694-5.881,3.944-10.068,3.944-10.068' }, container);
      elem('path', { class: 'scale scale-level-1', d: 'M121.417,218.708h-36.25c0,0,0.342,4.491,2.306,11.307c1.694,5.881,3.944,10.068,3.944,10.068' }, container);
      elem('polygon', { class: 'scale scale-glyph', points: '92.042,158.554 88.167,160.792 92.813,162.73' }, container);
      elem('polygon', { class: 'scale scale-glyph', points: '92.042,241.446 88.167,239.208 92.813,237.27' }, container);
      elem('text', { class: 'label tiny left', x: 125, y: 184 }, container, 'UP');
      elem('text', { class: 'label tiny left', x: 125, y: 222 }, container, 'DOWN');
    },
    renderAltimeterFace : function(container) {
      var path = elem('path', { class: 'instrument-face', d: 'M200.333,47c-84.497,0-153,68.503-153,153s68.503,153,153,153 s153-68.503,153-153S284.831,47,200.333,47zM275.85,221.422c1.929-6.813,2.984-13.992,2.984-21.422c0-7.397-1.045-14.546-2.958-21.332l49.113-13.869c3.155,11.193,4.846,23,4.846,35.201c0,12.256-1.704,24.114-4.886,35.351L275.85,221.422z' }, container);
      [ 'M154.451,277.04c6.239,3.724,12.973,6.701,20.072,8.833l-18.447-11.562L154.451,277.04z',
        'M160.444,266.978l36.045,22.592c1.275,0.054,2.555,0.09,3.844,0.09c4.176,0,8.285-0.286,12.308-0.839l-47.482-29.761L160.444,266.978z',
        'M169.527,251.726l55.169,34.578c3.801-1.072,7.5-2.386,11.079-3.929l-61.533-38.566L169.527,251.726z',
        'M200.333,240.833c-7.636,0-14.773-2.12-20.868-5.794l-0.855,1.437l66.101,41.43c0.482-0.275,0.967-0.544,1.443-0.828l-8.686-14.584l-34.692-21.744C201.967,240.797,201.155,240.833,200.333,240.833z',
        'M221.14,235.076c-2.025,1.216-4.173,2.242-6.408,3.095l13.165,8.252L221.14,235.076z',
      ].forEach(function(d) {
        elem('path', { class: 'altimeter-stripes', d: d}, container);
      });
      elem('text', { class: 'label scale-label', x: 300, y: 157 }, container, '2');
      elem('text', { class: 'label scale-label', x: 300, y: 250 }, container, '3');
    },
    renderPressureDial : function(container) {
      var g     = elem('g', { class: 'pressure-dial', id: this.indicatorId }, container);
      var circ  = elem('circle', { cx: 200, cy: 200, r: 161 }, g);
      
      var o           = { x:constants.cx / 2, y:constants.cy / 2 };
      var valueStep   = this.pressureDialStep | 5;
      var valueStart  = this.registers[0].minValue;
      var valueRange  = this.registers[0].maxValue - this.registers[0].minValue;
      var angleStart  = -90;
      var angleRange  = 110;
      
      var getPath  = function(radius) {
        var pt1    = vectorToPoint(o, angleStart, radius);
        var pt2    = vectorToPoint(o, angleStart + angleRange, radius);
        return elem('path', { d: 'M' + pt1.x + ',' + pt1.y + 'A' + radius + ',' + radius + ' 0 0,1 ' + pt2.x + ',' + pt2.y });
      };
      
      var getPoint = function(path, value) {
        return path.getPointAtLength(path.getTotalLength() - (path.getTotalLength() / valueRange) * (i - valueStart));
      }
      
      var path1 = getPath(126);
      var path2 = getPath(114);
      var path3 = getPath(123);
      var path4 = getPath(117);
      var path5 = getPath(110);
      
      for(var i = valueStart + valueRange; i >= valueStart; i--) {
        if(i % valueStep == 0) {
          var pt1 = getPoint(path1, i);
          var pt2 = getPoint(path2, i);
          var pt3 = getPoint(path5, i);
          var rt  = angleStart + ((angleRange / valueRange) * (valueStart + valueRange - i));
          elem('line', { x1: pt1.x, y1: pt1.y, x2: pt2.x, y2: pt2.y, class: 'scale scale-level-1' }, g);
          elem('text', { x: pt3.x, y: pt3.y, class: 'label pressure-scale-label', transform: 'rotate(' + rt + ' ' + pt3.x + ',' + pt3.y + ')' }, g, i);
        } else {
          var pt1 = getPoint(path3, i);
          var pt2 = getPoint(path4, i);
          elem('line', { x1: pt1.x, y1: pt1.y, x2: pt2.x, y2: pt2.y, class: 'scale scale-level-2' }, g);
        }
      }
    },
    renderAltimeterTop : function(container) {
      $.GT.renderBezel(container);
      
      elem('polygon', { points: '327,200 333,194 333,206', class: 'scale-glyph' }, container);
    },
    renderHorizonIndicator : function(container) {
      var grad = elem('linearGradient', { id: 'attitudeBackgroundFill', gradientUnits: 'userSpaceOnUse', x1: 200, y1: 350, x2: 200, y2: 50 }, container);
      elem('stop', { offset: 0.4999 }, grad);
      elem('stop', { offset: 0.5001 }, grad);
      
      var grad2 = elem('linearGradient', { id: 'attitudeBackgroundFillSmooth', gradientUnits: 'userSpaceOnUse', x1: 200, y1: 276, x2: 200, y2: 124 }, container);
      elem('stop', { offset: 0 }, grad2);
      elem('stop', { offset: 0.4999 }, grad2);
      elem('stop', { offset: 0.5001 }, grad2);
      elem('stop', { offset: 1 }, grad2);
      
      var g = elem('g', { id: this.indicatorId + '-roll' }, container);
      elem('circle', {class: 'attitude-roll-indicator', cx: 200, cy: 200, r: 150 }, g);
      
      var g2 = elem('g', { id: this.indicatorId + '-pitch' }, g);
      elem('path', { class: 'attitude-pitch-indicator', d: 'M301.333,200.333c0,41.936-33.963,75.938-75.885,76c-0.038,0-50.076,0-50.114,0c-41.974,0-76-34.026-76-76s34.026-76,76-76c0.027,0,50.056,0,50.083,0C267.352,124.377,301.333,158.387,301.333,200.333z' }, g2);
      elem('line', { class: 'attitude-marking-scale round', x1: 99.667,  y1: 200.457, x2: 301.667, y2: 200.457 }, g2);
      elem('line', { class: 'attitude-marking-scale round', x1: 187.979, y1: 187.374, x2: 212.979, y2: 187.374 }, g2);
      elem('line', { class: 'attitude-marking-scale round', x1: 188.167, y1: 213.499, x2: 213.167, y2: 213.499 }, g2);
      elem('line', { class: 'attitude-marking-scale round', x1: 188.026, y1: 241.42,  x2: 213.026, y2: 241.42 }, g2);
      elem('line', { class: 'attitude-marking-scale round', x1: 188.167, y1: 159.374, x2: 213.167, y2: 159.374 }, g2);
      elem('line', { class: 'attitude-marking-scale round', x1: 180.042, y1: 173.405, x2: 220.042, y2: 173.405 }, g2);
      elem('line', { class: 'attitude-marking-scale round', x1: 180.042, y1: 227.499, x2: 220.042, y2: 227.499 }, g2);
      elem('line', { class: 'attitude-marking-scale round', x1: 170.042, y1: 255.332, x2: 230.042, y2: 255.332 }, g2);
      elem('line', { class: 'attitude-marking-scale round', x1: 170.042, y1: 145.333, x2: 230.042, y2: 145.333 }, g2);
      elem('text', { class: 'label small', x: 165, y: 173 }, g2, '10');
      elem('text', { class: 'label small', x: 235, y: 173 }, g2, '10');
      elem('text', { class: 'label small', x: 165, y: 227 }, g2, '10');
      elem('text', { class: 'label small', x: 235, y: 227 }, g2, '10');
      elem('text', { class: 'label small', x: 155, y: 146 }, g2, '20');
      elem('text', { class: 'label small', x: 245, y: 146 }, g2, '20');
      elem('text', { class: 'label small', x: 155, y: 256 }, g2, '20');
      elem('text', { class: 'label small', x: 245, y: 256 }, g2, '20');
      
      elem('path', { class: 'attitude-roll-indicator', d: 'M200.667,50.4C117.953,50.4,50.9,117.453,50.9,200.167s67.053,149.767,149.767,149.767s149.767-67.053,149.767-149.767S283.38,50.4,200.667,50.4z M200.667,300.5c-55.413,0-100.334-44.921-100.334-100.334c0-55.412,44.921-100.333,100.334-100.333C256.079,99.833,301,144.753,301,200.166C301,255.579,256.079,300.5,200.667,300.5z' }, g);
      elem('line', { class: 'attitude-marking-scale', x1: 50.667,  y1:200.333,  x2:100.333,  y2:200.333 }, g);
      elem('line', { class: 'attitude-marking-scale', x1: 300.749, y1: 200.333, x2: 350.433, y2: 200.333 }, g);
      elem('line', { class: 'attitude-marking-scale', x1: 78.415,  y1: 131.582, x2: 112.082, y2: 151.915 }, g);
      elem('line', { class: 'attitude-marking-scale', x1: 288.751, y1: 151.915, x2: 323.585, y2: 131.582 }, g);
      elem('line', { class: 'attitude-marking-scale', x1: 149.418, y1: 113.75,  x2: 129.418, y2: 79.25 }, g);
      elem('line', { class: 'attitude-marking-scale', x1: 252.084, y1: 113.75,  x2: 272.751, y2: 79.25 }, g);
      elem('polygon', { class: 'attitude-marking-scale', points: '185.918,60.085 215.251,60.085 200.585,98.918' }, g);
      elem('polygon', { class: 'attitude-marking-scale', points: '119.084,117.417 112.082,124.251 126.584,131.582' }, g);
      elem('polygon', { class: 'attitude-marking-scale', points: '274.084,131.582 281.251,117.417 288.751,124.5' }, g);
    },
    renderHorizonTop : function(container) {
      elem('line', { class: 'attitude-marking-wings', x1: 130, y1:200, x2:176, y2:200 }, container);
      elem('line', { class: 'attitude-marking-wings', x1: 225, y1:200, x2:271, y2:200 }, container);
      elem('line', { class: 'attitude-marking-wings', x1: 200, y1:200, x2:200, y2:200 }, container);
      elem('line', { class: 'attitude-marking-wings', x1: 200, y1:103, x2:190, y2:130 }, container);
      elem('line', { class: 'attitude-marking-wings', x1: 190, y1:130, x2:210, y2:130 }, container);
      elem('line', { class: 'attitude-marking-wings', x1: 210, y1:130, x2:200, y2:103 }, container);
      
      elem('path', { class: 'attitude-bottom', d: 'M82.663,298.167c28.157,33.81,70.564,55.333,118.004,55.333s89.847-21.524,118.004-55.333H82.663z' }, container);
      elem('line', { class: 'attitude-marking-scale', x1: 200, y1: 298, x2: 200, y2: 329 }, container);
      elem('line', { class: 'attitude-marking-scale', x1: 254, y1: 298, x2: 254, y2: 308 }, container);
      elem('line', { class: 'attitude-marking-scale', x1: 146, y1: 298, x2: 146, y2: 308 }, container);
    },
    renderLabel : function(container) {
      elem('text', { x: this.position.x, y: this.position.y, class: this.class, 'font-family': this.font, 'font-size': this.fontsize, fill: this.color, stroke: this.color, 'stroke-width': this.strokewidth, 'stroke-miterlimit': this.strokemiterlimit  }, container, this.caption);
    },
    renderRadialRange : function(container) {
      var origin      = { x:constants.cx / 2, y:constants.cy / 2 };
      
      var getD = function(radius, angleStart, angleEnd, arcBack) {
        var p1          = vectorToPoint(origin, (arcBack ? angleEnd : angleStart), radius);
        var p2          = vectorToPoint(origin, (arcBack ? angleStart : angleEnd), radius);

        var d           = (arcBack ? '' : 'M' + p1.x + ',' + p1.y + ' ') + 'A' + radius + ',' + radius + ' 0';
        if(Math.abs(angleEnd - angleStart) <= 180) {
          d += ' 0,' + (arcBack ? '0 ' : '1 ') + p2.x + ',' + p2.y;
        } else {
          var p3          = vectorToPoint(origin, angleStart + 180, radius);
          d += ' 0,' + (arcBack ? '0 ' : '1 ') + p3.x + ',' + p3.y + ' A' + radius + ',' + radius + ' 0 0,1 ' + p2.x + ',' + p2.y;
        }
        
        return d;
      };
      
      var register    = this.parent.registers[0];
      var degreeStart = this.parent.movementStart;
      
      var angleStart  = -180 + degreeStart + (this.fromValue - register.minValue) * this.parent.degreesPerValue;
      var angleEnd    = angleStart + ((this.toValue - this.fromValue) * this.parent.degreesPerValue); 
      var r4          = vectorToPoint(origin, angleEnd, this.offset + this.extent);

      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      if(this.color)
        path.setAttribute('fill', this.color);
      if(this.stroke)
        path.setAttribute('stroke', this.stroke);

      path.setAttribute('class', this.class);
      path.setAttribute('d', getD(this.offset, angleStart, angleEnd) + ' L' + r4.x + ',' + r4.y + getD(this.offset + this.extent, angleStart, angleEnd, true) + ' Z');

      container.appendChild(path);
      
      if(this.scales && this.scales.length) {
        var tcount = 1;
        var range  = this;
        this.scales.forEach(function(scale, i) {
          scale.curinterval = 0;
          scale.rp1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
          scale.rp2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
          scale.rp1.setAttribute('d', getD(range.offset + scale.offset, angleStart, angleEnd));
          scale.rp2.setAttribute('d', getD(range.offset + scale.extent, angleStart, angleEnd));
          if(scale.label) {
            scale.label.rp = document.createElementNS("http://www.w3.org/2000/svg", "path");
            scale.label.rp.setAttribute('d', getD(range.offset + scale.label.offset, angleStart, angleEnd));
          }
          
          tcount *= scale.divisions;
        });
        
        /* If this is a clock face then the start and end markings will be in the same position, so don't render the last marking. */
        var lastMark   = (this.parent.modulo) ? tcount-1 : tcount;  
        var valRange   = this.parent.modulo ? this.parent.modulo : (range.toValue - range.fromValue);
        var valPerTick = valRange / tcount;
        
        for(var i=0;i<=lastMark;i++) {
          for(var t=range.scales.length-1;t>0;t--)
            if(i % range.scales[t].divisions != 0) // todo: use some kind of modulo
              break;
          
          var val    = range.fromValue + (i * valPerTick);
          var scale  = this.scales[t]; 
          var pt1    = scale.rp1.getPointAtLength((scale.rp1.getTotalLength() / tcount) * i);
          var pt2    = scale.rp2.getPointAtLength((scale.rp2.getTotalLength() / tcount) * i);
          
          var _skipFunc = function(v) {
            switch(typeof v) {
              case 'number':
                return !(v == val);
              case 'object':
                if(v.notmodulo && !(val % v.notmodulo == 0)) return false;
                if(v.modulo && val % v.modulo == 0) return false;
                if(v.below != undefined && val < v.below) return false;
                if(v.above != undefined && val > v.above) return false;
                return true;
              default:
                return true;
            }
          };
          
          if(!scale.skip || scale.skip.every(_skipFunc)) {
            var line   = document.createElementNS("http://www.w3.org/2000/svg", "line");
            if(scale.color)
              line.setAttribute('stroke', scale.color);
            
            line.setAttribute('class', scale.class);
            line.setAttribute('x1', pt1.x);
            line.setAttribute('y1', pt1.y);
            line.setAttribute('x2', pt2.x);
            line.setAttribute('y2', pt2.y);
            
            container.appendChild(line);
            
            var label = scale.label;
            if(label) {
              if(!label.skip || label.skip.every(_skipFunc)) {
                label.parent   = scale;
                label.caption  = label.formatFunction(val);
                label.position = label.rp.getPointAtLength((label.rp.getTotalLength() / tcount) * i); 
                
                if(label.render)
                  label.render(container);
              }
            }
          }
        }
      }
    },
    radialGaugeMechanics : function(settings, container) {
      var indicatorElem = container.querySelector('#' + settings.indicatorId);
      if(settings.registers && settings.registers.length && indicatorElem) {
        var register        = settings.registers[0];
        var degreeStart     = settings.movementStart;
        var f               = (settings.clockwise) ? 1 : -1;
      
        register.addListener(function(val) {
          var degrees = degreeStart + (val - register.minValue) * settings.degreesPerValue * f;
          indicatorElem.setAttribute('transform', 'rotate(' + degrees + ' 200 200)');
        });
      }
    },
    clockGaugeMechanics : function(settings, container) {
      var indicatorElem = container.querySelector('#' + settings.indicatorId);
      if(settings.registers && settings.registers.length && indicatorElem) { 
        var register        = settings.registers[0];
        var degreeStart     = settings.movementStart;
        var f               = (settings.clockwise) ? 1 : -1;
        
        register.addListener(function(val) {
          var degrees = degreeStart + (val % settings.modulo) * settings.degreesPerValue * f;
          indicatorElem.setAttribute('transform', 'rotate(' + degrees + ' 200 200)');
        });
      }
    },
    gyroHorizonMechanics : function(settings, container) {
      var rollIndicator  = container.querySelector('#' + settings.indicatorId + '-roll');
      var pitchIndicator = container.querySelector('#' + settings.indicatorId + '-pitch');
      var pitchReg       = settings.registers[0];
      var rollReg        = settings.registers[1];
      var pitchF         = 2.7;
      
      pitchReg.addListener(function(val) {
        if(val < -32) val = -32; else if(val > 32) val = 32;
        pitchIndicator.setAttribute('transform', 'translate(0 ' + (val * pitchF) + ')');
      });
      
      rollReg.addListener(function(val) {
        rollIndicator.setAttribute('transform', 'rotate(' + val + ' 200 200)');
      });
    },
    noMechanics : function(settings, container) {
      
    },
  };
  
  $.heading = function(placeholder, options) {
    return $.instrument(placeholder, $.extend(true, { 
      class: 'heading',
      renderTop: $.GT.renderHeadingMarkings,
      registers: [ { 
        maxValue : 360, 
        minValue : 0, 
        setFuncName: 'setHeading', 
        getFuncName: 'getHeading',
        inputConversion: function(val) {
          val = val % 360;
          if(val < 0)
            val = 360 + val;
          return val;
        }
      }, 
      { 
        maxValue : 360, 
        minValue : 0, 
        setFuncName: 'setBeacon1', 
        getFuncName: 'getBeacon1',
        inputConversion: function(val) {
          val = val % 360;
          if(val < 0)
            val = 360 + val;
          return val;
        }
      }, 
      { 
        maxValue : 360, 
        minValue : 0, 
        setFuncName: 'setBeacon2', 
        getFuncName: 'getBeacon2',
        inputConversion: function(val) {
          val = val % 360;
          if(val < 0)
            val = 360 + val;
          return val;
        }
      } ],
      gauges : [ { 
        registers: [0],
        movementRange: 360,
        movementStart: 0,
        clockwise: false,
        renderIndicator: $.GT.renderCompassRose
      }, 
      {
        registers: [1],
        movementRange: 360,
        movementStart: 0,
        clockwise: true,
        visible: options.beacon1Visible || false,
        showFuncName: 'showBeacon1',
        renderIndicator: $.GT.renderBeaconOne
      }, 
      {
        registers: [2],
        movementRange: 360,
        movementStart: 0,
        clockwise: true,
        visible: options.beacon2Visible || false,
        showFuncName: 'showBeacon1',
        renderIndicator: $.GT.renderBeaconTwo
      } ]
    }, options));
  }
  
  $.airspeed = function(placeholder, options) {
    return $.instrument(placeholder, $.extend(true, { 
      class: 'airspeed',
      registers: [ { maxValue : 160, minValue : 0, setFuncName: 'setAirspeed', getFuncName: 'getAirspeed' } ],
      gauges : [ { 
        movementRange: 320,
        movementStart: 90,
        labels: [ { caption: 'AIR SPEED', position: {x:200, y:160} }, { caption: 'KNOTS', position: {x:200, y:240} } ],
        ranges: [ 
          { offset: 150, extent: -10, fromValue:30, toValue:100,  color:'#007511' }, 
          { offset: 150, extent: -10, fromValue:100,  toValue:140,   color:'#f9ff00' }, 
          { offset: 150, extent: -10, fromValue:140,   toValue:160,  color:'#ff0000' }, 
          { offset: 150, class: 'hidden', fromValue:0, toValue:30, scales: [ { class: 'scale scale-level-2', divisions: 12, extent:-10, skip: [0, 30, { modulo: 5 }] } ] },
          { offset: 150, class: 'hidden', scales: [ { divisions: 16, extent:-20, label: { skip:[{ notmodulo:20}] } }, { divisions: 2, extent:-16 }, /*{ divisions: 2, extent: -10 }*/ ] } ]
        } ], 
    }, options));
  }
  
  $.altimeter = function(placeholder, options) {
    return $.instrument(placeholder, $.extend(true, {
      class: 'altimeter',
      renderFace : null,
      renderTop  : $.GT.renderAltimeterTop,
      registers: [ 
        { maxValue : 30000, minValue : 0,   setFuncName: 'setAltitude', getFuncName: 'getAltitude' },
        { maxValue : 1040,  minValue : 975, setFuncName: 'setPressure', getFuncName: 'getPressure' } ],
      gauges : [ 
        { registers: [1], movementStart : -20, movementRange: 110,  renderIndicator: $.GT.renderPressureDial
        }, 
        { registers: [0], movementStart : 90, movementRange: 360, modulo: 10000, renderBase: $.GT.renderAltimeterFace, renderIndicator: $.GT.renderSmallNeedle, mechanics: $.GT.clockGaugeMechanics,
          labels: [ 
            { class: 'label large', caption: 'ALT', position: {x:200, y:155} },
            { class: 'label small', caption: '1000 FEET', position: {x:200, y:130} },
            { class: 'label small', caption: '100', position: {x:180, y:85} },
            { class: 'label small', caption: 'FEET', position: {x:225, y:85} },
            { class: 'label small', caption: 'CALIBRATED', position: {x:145, y:185} }, 
            { class: 'label small', caption: 'TO', position: {x:145, y:200} },
            { class: 'label small', caption: '25 000 FEET', position: {x:145, y:215} } ],
          ranges: [ 
            { class: 'hidden', offset: 150, scales: [ { divisions: 10, extent:-25, label: { formatFunction: function(v) { return v/1000; }, skip: [2000, 3000] } }, { divisions: 5, extent: -20 } ] } ],
        },
        {
          registers: [0], movementStart : 90, movementRange: 360, modulo: 1000, mechanics: $.GT.clockGaugeMechanics,
        } ], 
    }, options));
  }
  
  $.variometer = function(placeholder, options) {
    var obj = $.instrument(placeholder, $.extend(true, {
      class: 'variometer',
      registers: [ 
        { maxValue : 2, minValue : -2,   setFuncName: 'setVario', getFuncName: 'getVario' } ],
      gauges : [ 
        { registers: [0], movementStart: 180, movementRange: 360, renderBase: $.GT.renderVarioFace, renderIndicator: $.GT.renderNeedle, mechanics: $.GT.radialGaugeMechanics,
          labels: [ 
            { class: 'label', caption: 'VERTICAL SPEED', position: {x:200, y:165} },
            { class: 'label', caption: '1000 FEET PER MIN', position: {x:200, y:235} }],
          ranges: [ 
            { class: 'hidden', offset: 150, scales: [ { divisions: 8, extent:-25, label: {  }, skip:[ { above:1.9, below:-1.9 } ] }, { divisions: 5, extent: -20 }, { divisions: 2, extent: -15, skip: [{above:0.5, below:-0.5}] } ] }, ],
        }], 
    }, options));
    
    var f = obj.setVario;
    obj.setVario = function(v) { if(v < -1.9) { v = -1.9 } else if(v > 1.9) { v = 1.9 } f(v); };
    
    return obj;
  }
  
  $.attitude = function(placeholder, options) {
    return $.instrument(placeholder, $.extend(true, {
      class: 'attitude',
      registers: [
        { minValue: -90,  maxValue:  90, value: options.pitch || 0, setFuncName: 'setPitch', getFuncName: 'getPitch', inputConversion: function(val) { val = val % 180; if(val < -90) val = 180 + val; else if(val > 90) val = -180 + val; return val; } },
        { minValue: -180, maxValue: 180, value: options.roll  || 0, setFuncName: 'setRoll', getFuncName: 'getRoll', inputConversion: function(val) { val = val % 360; if(val < -180) val = 360 + val; else if(val > 180) val = -360 + val; return val;  } } ],
      gauges: [
        {
          registers: [0,1], renderIndicator: $.GT.renderHorizonIndicator, renderTop: $.GT.renderHorizonTop, mechanics: $.GT.gyroHorizonMechanics
        }
      ]
    }, options));
  }

  $.instrument = function(placeholder, options){
		var instr = new Instrument($(placeholder), options)
		return instr;
	}

	$.fn.instrument = function(data, options){
		return this.each(function(){
			$.instrument(this, options);
		});
	}
  
  var constants = {
    /* SVG canvas width */
    cx : 400,
    cy : 400,      
  };
  
  function vectorToPoint(origin, angle, distance) {
    return {
      x: Math.round(Math.cos(angle * Math.PI / 180) * distance + origin.x),
      y: Math.round(Math.sin(angle * Math.PI / 180) * distance + origin.y)
    };
  }
  
  function elem(name, attribs, parent, text) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    if(attribs) {
      $.each(attribs, function(nm, val) {
        if(val != null && val != undefined) {
          el.setAttribute(nm, val);
        }
      });
    }
    
    if(parent != undefined)
      parent.appendChild(el);
    if(text != undefined)
      el.textContent = text;
    
    return el;
  }
  
}(jQuery));
