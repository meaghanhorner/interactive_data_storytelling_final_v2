// nada //
// =========================================================================
// TRUE GLOBALS — only what actually needs to be shared across functions
// =========================================================================
const chartRegistry = {};
const scroller = scrollama();

const COLOR = {
  profit: getComputedStyle(document.documentElement).getPropertyValue('--color-profit').trim(),
  even:   getComputedStyle(document.documentElement).getPropertyValue('--color-even').trim(),
  loss:   getComputedStyle(document.documentElement).getPropertyValue('--color-loss').trim(),
};




// =========================================================================
// CHART C — PRODUCTIVITY AND PAY LINE CHART
// =========================================================================

function drawStaticEpiChart(containerSelector, jsonPath) {
  // All layout vars local to this chart
  const m      = { top: 70, right: 0, bottom: 150, left: 50 };
  const width  = 700 - m.left - m.right;
  const height = 700 - m.top - m.bottom;

  const container = d3.select(containerSelector);
  container.selectAll('*').remove();

const svg = container
    .append('svg')
    .attr('viewBox', '0 0 860 600')
    .style('width', '100%')
    .style('height', 'auto');

  svg.append('defs').append('clipPath')
    .attr('id', 'epi-plot-clip')
    .append('rect')
    .attr('width', width)
    .attr('height', height);

  const svgGroup = svg.append('g')
    .attr('transform', `translate(${m.left},${m.top})`);

  d3.json(jsonPath).then(data => {
    const cleanData = data.map(d => {
      const [yearStr, qStr] = d.Year.split('q');
      const monthIndex = [0, 0, 3, 6, 9][+qStr];
      return {
        date:         new Date(+yearStr, monthIndex, 1),
        productivity: +d.Productivity,
        pay:          +d.Pay,
      };
    }).filter(d => !isNaN(d.date.getTime()));

    // Scales
    const xScale = d3.scaleTime().range([0, width]);
    const yScale = d3.scaleLinear().range([height, 0]);

    // Generator factories — called with a key string, return a configured generator
    const makeLine = key => d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d[key]));

    const makeAreaShading = () => d3.area()
      .x(d => xScale(d.date))
      .y0(d => yScale(d.pay))
      .y1(d => yScale(d.productivity));

    // Structural DOM elements
    const xAxisGroup = svgGroup.append('g').attr('class', 'epi-x-axis').attr('transform', `translate(0,${height})`);
    const yAxisGroup = svgGroup.append('g').attr('class', 'epi-y-axis');

    const linesRenderLayer = svgGroup.append('g').attr('clip-path', 'url(#epi-plot-clip)');

    const shadingPath = linesRenderLayer.append('path')
  .datum(cleanData)
  .attr('class', 'epi-shading-gap')
  .attr('fill', '#278091')
  .attr('fill-opacity', 0)
  .attr('d', makeAreaShading());

    const linesConfig = [
      { key: 'productivity', color: '#278091', label: 'Productivity' },
      { key: 'pay',          color: '#cc4435', label: 'Hourly Pay'   },
    ];

    const linePaths = {};
    const labels = {};

    linesConfig.forEach(({ key, color, label }) => {
      linePaths[key] = linesRenderLayer.append('path')
        .datum(cleanData)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 3);

      labels[key] = svgGroup.append('text')
        .attr('alignment-baseline', 'middle')
        .attr('fill', color)
        .attr('dx', '14px')
        .style('font-weight', 'bold')
        .style('font-family', "'Barlow Condensed', sans-serif")
        .style('font-size', '20px')
        .text(label);
    });

    // Titles
    svgGroup.append('text').attr('x', 0).attr('y', -40)
      .attr('font-size', '22px').attr('font-weight', '700')
      .attr('fill', '#1a1a1a').attr('font-family', "'Playfair Display', Georgia, serif")
      .text('Productivity and Hourly Pay diverged sharply starting around 1980');

    svgGroup.append('text').attr('x', 0).attr('y', -12)
      .attr('font-size', '20px').attr('font-style', 'italic')
      .attr('fill', '#666').attr('font-family', "'Playfair Display', Georgia, serif")
      .text('Indexed growth of productivity and pay since 1948');

    // SVG tooltip group (local — no more bare svgTooltipG in animation function)
    const svgTooltipG = svgGroup.append('g')
      .attr('class', 'epi-svg-tooltip')
      .style('display', 'none')
      .style('pointer-events', 'none');

    svgTooltipG.append('rect')
      .attr('width', 220).attr('height', 115)
      .attr('fill', 'rgba(255, 255, 255, 0.96)')
      .attr('stroke', '#1a1a1a').attr('stroke-width', 1);
    


    const tTextYear = svgTooltipG.append('text').attr('x', 10).attr('y', 22).style('font-family', "'Barlow', sans-serif").style('font-size', '22px').style('fill', '#333');
    const tTextProd = svgTooltipG.append('text').attr('x', 10).attr('y', 50).style('font-family', "'Barlow', sans-serif").style('font-size', '20px').style('fill', '#278091');
    const tTextPay  = svgTooltipG.append('text').attr('x', 10).attr('y', 78).style('font-family', "'Barlow', sans-serif").style('font-size', '20px').style('fill', '#cc4435');
    const tTextGap  = svgTooltipG.append('text').attr('x', 10).attr('y', 106).style('font-family', "'Barlow', sans-serif").style('font-size', '20px').style('fill', '#1a1a1a');

    // Invisible pointer overlay rect
    const pointerOverlay = svgGroup.append('rect')
      .attr('class', 'epi-pointer-overlay')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'none')
      .attr('pointer-events', 'none');

    // Register the chart — bundle everything the animation function needs
    chartRegistry['chart-productivity'] = {
      meta: { container: document.getElementById('chart-productivity') },
      _currentState: 'null',

      step1: { data: cleanData },
      step2: { data: cleanData },
      step3: { data: cleanData },

      // Single context object passed into animation — all local refs live here
      fullDomain: {
        data:   cleanData,
        width:  width,
        height: height,
        scales:     { x: xScale, y: yScale },
        generators: { line: makeLine, area: makeAreaShading },
        elements: {
          xAxisGroup,
          yAxisGroup,
          linePaths,
          labels,
          shadingPath,
          pointerOverlay,
          svgTooltipG,   // ← stored here so animation function can reach it
          tTextYear,
          tTextProd,
          tTextPay,
          tTextGap,
        },
      },

      applyStep(stateName, stepData, shouldAnimate) {
        this._currentState = stateName;
        executeProductivityZoomAnimation(stateName, this, shouldAnimate);
      },

      uiSetup() {
        const node = document.getElementById('chart-productivity');
        if (node) node.style.display = '';
      },
    };

     chartRegistry['chart-productivity'].applyStep('step1', cleanData, false);

  }).catch(err => console.warn('EPI chart load failed:', err));
}




// =========================================================================
// CHART C — ANIMATION ENGINE
// =========================================================================
function executeProductivityZoomAnimation(targetStep, chartInstance, shouldAnimate) {
  if (!chartInstance || !chartInstance.fullDomain) {
    console.warn('Waiting for chart registry initialization...');
    return;
  }

  const ctx      = chartInstance.fullDomain;
  const dataArray = ctx.data;
  const width    = ctx.width;
  const height   = ctx.height;

  if (!dataArray || !dataArray.length) return;

  const dur    = shouldAnimate ? 1600 : 0;
  const easing = d3.easeCubicInOut;

  // Pull everything from the context bundle — no bare outer-scope references
  const xS        = ctx.scales.x;
  const yS        = ctx.scales.y;
  const genLine    = ctx.generators.line;
  const genArea    = ctx.generators.area;
  const pathsMap   = ctx.elements.linePaths;
  const labelsMap  = ctx.elements.labels;
  const sPath      = ctx.elements.shadingPath;
  const pOverlay   = ctx.elements.pointerOverlay;
  const tooltip    = ctx.elements.svgTooltipG;   // FIX: was bare `svgTooltipG` (undefined here)
  const tTextYear  = ctx.elements.tTextYear;
  const tTextProd  = ctx.elements.tTextProd;
  const tTextPay   = ctx.elements.tTextPay;
  const tTextGap   = ctx.elements.tTextGap;

  const dataUpTo1980 = dataArray.filter(d => d.date.getFullYear() <= 1980);
  const point1980    = dataArray.find(d => d.date.getFullYear() === 1980) || dataArray[0];
  const finalRecord  = dataArray[dataArray.length - 1];

  // Configure scale domains based on active step
  if (targetStep === 'step1') {
    xS.domain([new Date(1948, 0, 1), new Date(1980, 11, 31)]);
    const peak1980 = d3.max(dataUpTo1980, d => Math.max(d.productivity, d.pay));
    yS.domain([100, peak1980]).nice();
  } else {
    xS.domain(d3.extent(dataArray, d => d.date));
    const peakAbsolute = d3.max(dataArray, d => Math.max(d.productivity, d.pay));
    yS.domain([100, peakAbsolute]).nice();
  }

  // Transition axes
  ctx.elements.xAxisGroup.transition().duration(dur).ease(easing)
    .call(d3.axisBottom(xS).ticks(targetStep === 'step1' ? 6 : 10).tickFormat(d3.timeFormat('%Y')))
    .style('font-size', '14px');

  ctx.elements.yAxisGroup.transition().duration(dur).ease(easing)
    .call(d3.axisLeft(yS).tickFormat(d3.format("d")))
    .style('font-size', '14px');

  // Transition lines and end labels
  const alignTarget = (targetStep === 'step1') ? point1980 : finalRecord;
  Object.keys(pathsMap).forEach(key => {
    pathsMap[key].transition().duration(dur).ease(easing)
      .attr('d', genLine(key));

    labelsMap[key].transition().duration(dur).ease(easing)
      .attr('x', xS(alignTarget.date) + 8)
      .attr('y', yS(alignTarget[key]));
  });

  // Step-specific shading and interaction
  if (targetStep === 'step1' || targetStep === 'step2') {
    sPath.transition().duration(dur).ease(easing)
      .attr('fill-opacity', 0)
      .attr('d', genArea());

    pOverlay.attr('pointer-events', 'none').on('pointermove pointerenter pointerleave', null);
    tooltip.style('display', 'none');

  } else if (targetStep === 'step3') {
    sPath.transition().duration(dur).ease(easing)
      .attr('fill-opacity', 0.15)
      .attr('d', genArea());

    pOverlay
      .attr('pointer-events', 'all')
      .on('pointermove pointerenter', function(event) {
        const chartWidth = xS.range()[1];
        const [mouseX]   = d3.pointer(event);
        const dateTarget = xS.invert(mouseX);

        // FIX: use dataArray from closure — the overlay rect has no datum bound to it
        const bisect = d3.bisector(d => d.date).left;
        const idx    = bisect(dataArray, dateTarget, 1);
        const d0     = dataArray[idx - 1];
        const d1     = dataArray[idx];
        if (!d0 || !d1) return;
        const d = dateTarget - d0.date > d1.date - dateTarget ? d1 : d0;

        const gap           = (d.productivity - d.pay).toFixed(1);
        const yr            = d.date.getFullYear();
        const qLabel        = ['Q1', 'Q1', 'Q2', 'Q3', 'Q4'][Math.floor(d.date.getMonth() / 3) + 1];
        const boxWidth      = 180;
        const [, mouseY]    = d3.pointer(event);
        const tooltipX      = mouseX + 15 + boxWidth > chartWidth ? mouseX - boxWidth - 15 : mouseX + 15;
        const tooltipY      = mouseY - 50 < 0 ? mouseY + 5 : mouseY - 50;

        const formatIndex = d3.format(".1f"); // Formats to one decimal place (e.g., 142.3)
const formatRatio = d3.format(".2f"); // Formats the multiplier (e.g., 1.45x)

// 2. Calculate the structural multiplier
// If productivity is 150 and pay is 100, the multiplier is 1.50
const productivityMultiplier = d.productivity / d.pay;

// 3. Update the tooltip text fields
tTextYear.text(`Year: ${d.date.getFullYear()} Q${Math.floor(d.date.getMonth() / 3) + 1}`);

tTextProd.text(`Indexed Productivity: ${formatIndex(d.productivity)}`);
tTextPay.text(`Indexed Pay: ${formatIndex(d.pay)}`);

// 4. Clean, honest labeling for the gap
tTextGap.text(`Productivity Multiplier: ${formatRatio(productivityMultiplier)}x`);

        // FIX: reference `tooltip` (from ctx), not bare `svgTooltipG`
        tooltip.style('display', 'block')
          .attr('transform', `translate(${tooltipX},${tooltipY})`);
      })
      .on('pointerleave', () => tooltip.style('display', 'none'));
  }
}


// =========================================================================
// CHART D1 — Horizontal bar chart: MLM participant income distribution
// =========================================================================
function drawIncomeChart(containerSelector, jsonPath) {
  // All layout vars local to this chart
  const m      = { top: 120, right: 70, bottom: 30, left: 160 }; // Adjusted top for 2-line title
  const width  = 800 - m.left - m.right;
  const height = 600 - m.top  - m.bottom;

  const container = d3.select(containerSelector);
  container.selectAll('*').remove();

  const svg = container
    .append('svg')
    .attr('viewBox', '0 0 860 600')
    .style('width', '100%')
    .style('height', 'auto');

  const svgGroup = svg.append('g')
    .attr('transform', `translate(${m.left},${m.top})`);

  // Target income categories for the highlight step
  const targetIncomes = ["Below $35,000", "$35,000 to $49,999"];

  d3.json(jsonPath).then(data => {
    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.pct) * 1.08])
      .range([0, width]);

    const yScale = d3.scaleBand()
      .domain(data.map(d => d.E09b))
      .range([0, height])
      .padding(0.28);

    // Structural DOM elements
    const xAxisGroup = svgGroup.append('g')
      .attr('transform', `translate(0,${height})`);
    
    xAxisGroup.call(d3.axisBottom(xScale).tickFormat(d => `${Math.round(d * 100)}%`).ticks(6))
      .style('font-size', '20px')
      .style('font-family', "'Barlow Condensed', sans-serif");

    const yAxisGroup = svgGroup.append('g');
    yAxisGroup.call(d3.axisLeft(yScale).tickSize(0))
      .style('font-size', '20px')
      .style('font-family', "'Barlow Condensed', sans-serif")
      .call(ax => ax.select('.domain').remove());

    // Bars Render Layer
    const barsRenderLayer = svgGroup.append('g').attr('class', 'income-bars-layer');

    const bars = barsRenderLayer.selectAll('.bar')
      .data(data)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', d => yScale(d.E09b))
      .attr('width', d => xScale(d.pct))
      .attr('height', yScale.bandwidth())
      .attr('rx', 3)
      .attr('fill', COLOR.profit) // Default color matching your pattern
      .attr('opacity', 0.88);

    // Labels Render Layer
    const labelsRenderLayer = svgGroup.append('g').attr('class', 'income-labels-layer');

    const labels = labelsRenderLayer.selectAll('.income-bar-label')
      .data(data)
      .join('text')
      .attr('class', 'income-bar-label')
      .attr('x', d => xScale(d.pct) + 60)
      .attr('y', d => yScale(d.E09b) + yScale.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'end')
      .attr('font-size', '20px')
      .attr('font-weight', '700')
      .attr('font-family', "'Barlow Condensed', sans-serif")
      .attr('fill', '#278091')
      .text(d => d.pct_label);

    // Two-Line Title Setup (Group positioned relative to the SVG root)
    const titleGroup = svg.append('g')
      .attr('transform', 'translate(0, 35)')
      .attr('font-size', '24px')
      .attr('font-weight', '700')
      .attr('fill', '#1a1a1a')
      .attr('font-family', "'Playfair Display', Georgia, serif");

    titleGroup.append('text')
      .text('In 2018 nearly 2/3 of MLM participants had');

    titleGroup.append('text')
      .attr('dy', '30px')
      .text('household incomes under $50,000.');

    // Subtitle adjusted down to safely clear the 2-line title split
    svg.append('text')
      .attr('x', 0)
      .attr('y', 95)
      .attr('font-size', '20px')
      .attr('font-style', 'italic')
      .attr('fill', '#666')
      .attr('font-family', "'Playfair Display', Georgia, serif")
      .text('Household incomes of MLM participants');

    // Register the chart — matching your global state registry layout
    chartRegistry['chart-income-dist'] = {
      meta: { container: document.querySelector(containerSelector) },
      _currentState: 'null',

      step1: { data: data },
      step2: { data: data },

      // Single context object containing all local structural mutations
      fullDomain: {
        data:       data,
        width:      width,
        height:     height,
        targetIncomes: targetIncomes,
        scales:     { x: xScale, y: yScale },
        elements: {
          xAxisGroup,
          yAxisGroup,
          bars,
          labels,
          titleGroup
        }
      },

      applyStep(stateName, stepData, shouldAnimate) {
        this._currentState = stateName;
        
        // Isolate the animation loop cleanly to an execution function
        executeIncomeAnimation(stateName, this, shouldAnimate);
      },

      uiSetup() {
        const node = document.querySelector(containerSelector);
        if (node) node.style.display = '';
      }
    };

function executeIncomeAnimation(stateName, chart, shouldAnimate) {
  const { elements, targetIncomes } = chart.fullDomain;
  const dur = shouldAnimate ? 600 : 0;

  elements.bars
    .transition()
    .duration(dur)
    .ease(d3.easeCubicOut)
    .attr('fill', COLOR.profit)
    .style('opacity', d =>
      stateName === 'step2' && !targetIncomes.includes(d.E09b)
      ? 0.4
      : 1
    );


    elements.labels
    .transition()
    .duration(dur)
    .ease(d3.easeCubicOut)
    .attr('fill', COLOR.profit)
    .style('opacity', d =>
      stateName === 'step2' && !targetIncomes.includes(d.E09b)
        ? 0.4
        : 1
    );
}



    // Initialize state
    chartRegistry['chart-income-dist'].applyStep('step1', data, false);

  }).catch(err => console.warn('Income chart load failed:', err));
}


// =========================================================================
// CHART D — Animated bar chart (MLM profit/loss)
// =========================================================================
function initChart(containerId, copy) {
  const margin = { top: 16, right: 20, bottom: 72, left: 44 };
  const totalH = 400;
  const DUR    = +getComputedStyle(document.documentElement).getPropertyValue('--dur').trim();

  const block      = document.getElementById(containerId);
  const svgEl      = block.querySelector('.chart-svg');
  const frameTitle = block.querySelector('.frame-title');
  const annotation = block.querySelector('.annotation');
  const loading    = block.querySelector('.loading');
  const controls   = block.querySelector('.controls');

  const totalW = svgEl.getBoundingClientRect().width || 1600;
  const innerW = totalW - margin.left - margin.right;
  const innerH = totalH - margin.top  - margin.bottom;

  svgEl.setAttribute('height',  totalH);
  svgEl.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);

  const svg = d3.select(svgEl);
  const g   = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const x   = d3.scaleBand().range([0, innerW]).padding(.45);
  const y   = d3.scaleLinear().range([innerH, 0]);
  const gX  = g.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`);

  function draw(data, shouldAnimate, fullDomain) {
    const dur = shouldAnimate ? DUR : 0;

    fullDomain = ["Loss: $50,000 to $74,999", "Loss: $25,000 to $49,999", "Loss: $10,000 to $24,999", "Loss: $5,000 to $9,999", "Loss: Below $5,000", "Broke even", "Profit: Below $5,000", "Profit: $5,000 to $9,999", "Profit: $10,000 to $24,999", "Profit: $25,000 to $49,999", "Profit: $50,000 to $74,999", "Profit: $75,000 to $99,999", "Profit: $100,000 or more"];

    x.domain(fullDomain);
    y.domain([0, Math.ceil(d3.max(data, d => d.value) / 10) * 10 + 8]);

    x.domain(fullDomain);
    y.domain([0, Math.ceil(d3.max(data, d => d.value) / 10) * 10 + 8]);

    const activeLabels = new Set(data.filter(d => d.value > 0).map(d => d.label));
    const isStep1      = activeLabels.size < fullDomain.length;

    if (isStep1) {
      const profitStartX = x(fullDomain.find(l => activeLabels.has(l)));
      const profitEndX   = x(fullDomain.filter(l => activeLabels.has(l)).at(-1)) + x.bandwidth();
      const offset       = (innerW - (profitEndX - profitStartX)) / 2 - profitStartX;
      g.transition().duration(dur).ease(d3.easeCubicOut)
        .attr('transform', `translate(${margin.left + offset},${margin.top})`);
    } else {
      g.transition().duration(dur).ease(d3.easeCubicOut)
        .attr('transform', `translate(${margin.left},${margin.top})`);
    }

    const allData = fullDomain.map(label =>
      data.find(d => d.label === label) || { label, value: 0, type: 'profit' }
    );




    const bars = g.selectAll('.bar').data(allData, d => d.label);
    bars.enter().append('rect').attr('class', 'bar')
      .attr('x', d => x(d.label)).attr('width', x.bandwidth())
      .attr('y', innerH).attr('height', 0).attr('rx', 3)
      .attr('fill', d => COLOR[d.type]).attr('opacity', 0)
    .merge(bars).transition().duration(dur).ease(d3.easeCubicOut)
      .attr('x', d => x(d.label)).attr('width', x.bandwidth())
      .attr('y', d => y(d.value)).attr('height', d => innerH - y(d.value))
      .attr('fill', d => COLOR[d.type])
      .attr('opacity', d => d.value === 0 ? 0 : 0.88);

    bars.exit().transition().duration(dur * 0.6)
      .attr('opacity', 0).attr('height', 0).attr('y', innerH).remove();

    const barLabels = g.selectAll('.bar-label').data(allData, d => d.label);
    barLabels.enter().append('text').attr('class', 'bar-label')
      .attr('x', d => x(d.label) + x.bandwidth() / 2)
      .attr('y', d => y(d.value) - 6)
      .attr('opacity', 0)
      .attr('text-anchor', 'middle')
      .style('font-size', '28px')
      .style('font-family', "'Barlow Condensed', sans-serif")
      .text(d => d.value + '%')
    .merge(barLabels)
      .text(d => d.value + '%')
      .transition().duration(dur).ease(d3.easeCubicOut)
      .attr('x', d => x(d.label) + x.bandwidth() / 2)
      .attr('y', d => y(d.value) - 6)
      .attr('opacity', d => activeLabels.has(d.label) ? 1 : 0);

    barLabels.exit().transition().duration(dur).attr('opacity', 0).remove();

    gX.call(d3.axisBottom(x).tickSize(0).tickPadding(20))
      .call(ax => {
        ax.select('.domain').remove();
        ax.selectAll('.tick text')
          .attr('text-anchor', 'middle')
          .style('font-size', '15px')
          .style('font-weight', '600')
          .style('font-family', "'Barlow Condensed', sans-serif")
          .style('opacity', d => activeLabels.has(d) ? 1 : 0)
          .each(function(d) {
            const el             = d3.select(this);
            const normalized     = d.replace(' to ', '–');
            const [type, amount] = normalized.split(': ');
            el.text('');
            el.append('tspan').attr('x', 0).attr('dy', '0').text(type);
            el.append('tspan').attr('x', 0).attr('dy', '1.4em').attr('fill-opacity', 0.65).text(amount || '');
          });
      });
  }

  const chartInstance = {
    meta: null,
    applyStep(stateName, stepData, shouldAnimate) {
      if (!stepData) return;
      const stepConfig = copy[stateName];
      if (stepConfig && this.meta) {
        frameTitle.textContent = stepConfig.title;
        annotation.textContent = stepConfig.annotation(this.meta);
        if (stepConfig.accentColor) annotation.style.borderColor = stepConfig.accentColor;
      }
      draw(stepData, shouldAnimate, this.fullDomain);
    },
    uiSetup() {
      loading.style.display = 'none';
      svgEl.style.display   = '';
      if (controls) controls.style.display = 'flex';
    },
  };

  
  chartRegistry[containerId] = chartInstance;
  return chartInstance;
}


// =========================================================================
// DATA LOADING + INITIALISATION
// =========================================================================
drawStaticEpiChart('#chart-productivity', 'productivity_wage.json');
drawIncomeChart('#chart-income-dist', 'mlm_income_dist.json');

Promise.all([
  d3.json('mlm-chart-data.json'),
  d3.json('fraud-growth.json'),
]).then(([mlmData, fraudData]) => {

  // mlm_copy is local here — only used in this callback
  const mlm_copy = {
    mlm_step1: {
      label:      d => `Among those who earned any profit (n=${d.nProfit})`,
      annotation: d => `${d.pctUnder5kOfProfit}% of those who earned a profit made under $5,000`,
      title:      'How much did profitable MLM participants earn?',
    },
    mlm_step2: {
      label:      d => `Among all participants (n=${d.nTotal})`,
      title:      'How much did all MLM participants earn or lose?',
      annotation: d => `${d.pctUnder5kOfProfit}% of those who earned a profit made under $5,000`,
    },
  };

  // Shared tooltip for charts that need a floating div (fraud chart)
  d3.select('.chart-tooltip').remove();
  const activeTooltip = d3.select('body')
    .append('div')
    .attr('class', 'chart-tooltip')
    .style('position',         'fixed')
    .style('visibility',       'hidden')
    .style('background-color', 'rgba(255,255,255,0.8)')
    .style('color',            '#000')
    .style('padding',          '8px 12px')
    .style('border-radius',    '4px')
    .style('font-size',        '22px')
    .style('z-index',          '99999')
    .style('pointer-events',   'none');

  // ── CHART B: fraud growth line chart ──────────────────────────────────
  const fraudContainer = document.getElementById('chart-fraud-growth');
  if (fraudContainer) {
    fraudContainer.innerHTML = '';

    const uniqueFraudData = fraudData.filter((value, index, self) =>
      self.findIndex(d => d.category === value.category && d.year === value.year) === index
    );
    const categoryTotals = Array.from(
      d3.rollup(uniqueFraudData, v => d3.sum(v, d => d.indexed), d => d.category)
    );
    const top5Categories = categoryTotals.sort((a, b) => b[1] - a[1]).slice(0, 5).map(d => d[0]);
    const filteredData   = uniqueFraudData.filter(d => top5Categories.includes(d.category));

    const groupedMap      = d3.group(filteredData, d => d.category);
    const fraudByCategory = Array.from(groupedMap).map(([category, entries]) => [
      category,
      entries.sort((a, b) => a.year - b.year),
    ]);

    const fm      = { top: 72, right: 220, bottom: 40, left: 60 };
    const fWidth  = 1800 - fm.left - fm.right;
    const fHeight =  900 - fm.top  - fm.bottom;

    const svg = d3.select(fraudContainer)
      .append('svg')
      .attr('viewBox', '0 0 1800 900')
      .style('width', '100%').style('height', 'auto').style('overflow', 'visible');

    svg.append('text').attr('x', fm.left).attr('y', 16)
      .attr('font-size', '36px').attr('font-weight', '700')
      .attr('fill', '#1a1a1a').attr('font-family', 'Playfair', 'Georgia', 'sans-serif')
      .text('Investment Scams, Business scams and Job-related scams have grown the most since 2017');

    svg.append('text').attr('x', fm.left).attr('y', 46)
      .attr('font-size', '30px').attr('font-style', 'italic').attr('fill', '#666').attr('font-family', 'Playfair', 'Georgia', 'sans-serif')
      .text('Indexed growth · Hover any line to explore');

    svg.append('text').attr('x', fm.left).attr('y', 920)
      .attr('font-size', '22px').attr('fill', '#999').attr('font-family', 'sans-serif')
      .text('Source: FTC Consumer Sentinel Network');

    const g           = svg.append('g').attr('transform', `translate(${fm.left},${fm.top})`);
    const colorScale  = d3.scaleOrdinal().domain(top5Categories)
      .range(['#cc4435', '#278091', '#788637', '#c97b1d', '#3c9b7c']);
    const xFraud      = d3.scaleLinear().domain(d3.extent(filteredData, d => d.year)).range([0, fWidth]);
    const yFraud      = d3.scaleLinear().domain([0, d3.max(filteredData, d => d.indexed - 100)]).range([fHeight, 0]);

    g.append('g').attr('transform', `translate(0,${fHeight})`)
      .call(
        d3.axisBottom(xFraud)
          .tickValues([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024])
          .tickFormat(d3.format('d')).tickPadding(8)
      )
      .style('font-size', '20px');

    g.append('g')
      .call(d3.axisLeft(yFraud).tickPadding(8).tickFormat(d => d === 0 ? '0%' : `+${d}%`))
      .style('font-size', '20px');

    const line = d3.line()
      .x(d => xFraud(d.year))
      .y(d => yFraud(d.indexed - 100));

    g.selectAll('.fraud-line')
      .data(fraudByCategory).enter().append('path')
      .attr('class', d => `fraud-line category-${d[0].toLowerCase().replace(/[^a-z0-9]/g, '-')}`)
      .attr('fill', 'none')
      .attr('stroke', d => colorScale(d[0]))
      .attr('stroke-width', 2.5)
      .attr('d', d => line(d[1]))
      .style('transition', 'stroke-opacity 0.4s ease, stroke 0.4s ease, opacity 0.4s ease');

    g.selectAll('.fraud-line-hit')
      .data(fraudByCategory).enter().append('path')
      .attr('class', 'fraud-line-hit')
      .attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 5)
      .style('pointer-events', 'all')
      .attr('d', d => line(d[1]))
      .on('mousemove', function(event, d) {
        const [categoryName, dataPoints] = d;
        const mouseX        = d3.pointer(event, this)[0];
        const targetYear    = Math.round(xFraud.invert(mouseX));
        const matchingPoint = dataPoints.find(p => +p.year === targetYear);
        if (matchingPoint) {
          const netGrowth = matchingPoint.indexed - 100;
          d3.select('.chart-tooltip')
            .style('visibility', 'visible')
            .style('font-size', '14px')
            .style('font-family', 'Barlow', 'sans-serif')
            .html(`<strong>${categoryName}</strong>
              <div style="margin-top:4px;">
                Year: ${targetYear} —
                <span style="color:${colorScale(categoryName)};font-weight:bold;">
                  ${netGrowth >= 0 ? '+' : ''}${netGrowth.toFixed(1)}%
                </span>
              </div>`)
            .style('top',  (event.clientY - 15) + 'px')
            .style('left', (event.clientX + 15) + 'px');
        }
      })
      .on('mouseleave', () => d3.select('.chart-tooltip').style('visibility', 'hidden'));

    const labelsData = fraudByCategory.map(d => {
      const pts = d[1];
      return { y: yFraud(pts[pts.length - 1].indexed - 100), data: d };
    }).sort((a, b) => a.y - b.y);

    const minSpacing = 54;
    for (let i = 1; i < labelsData.length; i++) {
      if (labelsData[i].y - labelsData[i - 1].y < minSpacing)
        labelsData[i].y = labelsData[i - 1].y + minSpacing;
    }
    for (let i = labelsData.length - 1; i >= 1; i--) {
      if (labelsData[i].y > fHeight - 15) {
        labelsData[i].y = fHeight - 15;
        if (labelsData[i].y - labelsData[i - 1].y < minSpacing)
          labelsData[i - 1].y = labelsData[i].y - minSpacing;
      }
    }

    const lineLabels = g.selectAll('.line-label')
      .data(labelsData).enter().append('text')
      .attr('class', d => `line-label value label-id-${d.data[0].replace(/\s+/g, '')}`)
      .attr('fill', d => colorScale(d.data[0]))
      .attr('font-size', '24px').attr('font-weight', '600')
      .style('font-family', "'Barlow Condensed', sans-serif")
      .style('transition', 'opacity 0.4s ease')
      .attr('text-anchor', 'start').attr('dominant-baseline', 'middle')
      .attr('x', d => xFraud(d.data[1][d.data[1].length - 1].year) + 15)
      .attr('y', d => d.y);

    lineLabels.call(parent => {
      parent.append('tspan').text(d => d.data[0]);
      parent.append('tspan')
        .attr('x', d => xFraud(d.data[1][d.data[1].length - 1].year) + 15)
        .attr('dy', '1.2em').attr('font-size', '24px').attr('font-weight', '600').style('font-family', "'Barlow Condensed', sans-serif")
        .text(d => {
          const pts           = d.data[1];
          const totalNetGrowth = pts[pts.length - 1].indexed - pts[0].indexed;
          return `${totalNetGrowth >= 0 ? '+' : ''}${totalNetGrowth.toFixed(0)}%`;
        });
    });
  }

  // ── CHART D: animated MLM profit/loss bar chart ───────────────────────
  const mlmChart      = initChart('block-chart-D', mlm_copy);
  mlmChart.meta       = mlmData.meta;
  mlmChart.fullDomain = mlmData.fullData.map(d => d.label);
  mlmChart.mlm_step1  = { data: mlmData.profitData };
  mlmChart.mlm_step2  = { data: mlmData.fullData };
  mlmChart.uiSetup();
  mlmChart.applyStep('mlm_step1', mlmChart.mlm_step1.data, false);

  // ── SCROLLAMA ─────────────────────────────────────────────────────────
  scroller.setup({ step: '.step', offset: 0.5, debug: false })
    .onStepEnter(({ element }) => {
      document.querySelectorAll('.step').forEach(e => e.classList.remove('is-active'));
      element.classList.add('is-active');
      updateChart(element);
    });

}).catch(err => console.error('Data load error:', err));


// =========================================================================
// SCROLLAMA STEP → CHART TRANSLATOR
// =========================================================================
function updateChart(element) {
  const chartId = element.dataset.chart;
  const stepId  = element.getAttribute('data-step');

  // RE-DECLARE THE COLOR SCALE HERE SO IT IS ACCESSIBLE TO THIS FUNCTION
  const colorScale = d3.scaleOrdinal()
    .domain(['Investment Scams', 'Job and Business Scams', 'Business Scams']) // Add your categories here
    .range(['#cc4435', '#278091', '#788637', '#c97b1d', '#3c9b7c']);

  if (chartId === 'fraud') {
  
  // ── 1. RESET ALL LINES & LABELS TO DEFAULT FULL COLOR ──
  // Re-declare scale locally so this function can access it
  const colorScale = d3.scaleOrdinal()
    .domain(['Investment Scams', 'Job and Business Scams', 'Business Scams']) // (Adjust names to match your data keys exactly if needed)
    .range(['#cc4435', '#278091', '#788637', '#c97b1d', '#3c9b7c']);

  // Reset lines
  d3.selectAll('.fraud-line')
    .attr('stroke', d => colorScale(d[0]))
    .attr('stroke-width', 2.5)
    .style('stroke-opacity', 1); // Ensure opacity is forced back to full

  // Reset labels: fix color, weight, and FORCE full opacity
  d3.selectAll('.line-label')
    .attr('fill', d => d && d.data ? colorScale(d.data[0]) : '#1a1a1a')
    .style('font-weight', '600')
    .style('opacity', 1); // 🔴 FORCE opacity reset so previous scroll states don't break them

  // ── 2. APPLY THE GREYED-OUT ISOLATION FOR STEP 2 ──
  if (stepId === 'chart-b-step2') {
    
    // Mute all lines and labels to a solid editorial grey (keep opacity at 1)
    d3.selectAll('.fraud-line').attr('stroke', '#ccc');
    d3.selectAll('.line-label').attr('fill', '#999');

    // Restore TARGET LINES to full color and thickness
    d3.selectAll('.fraud-line')
      .filter(function(d) {
        if (!d || !d[0]) return false;
        const cat = d[0].toLowerCase();
        return cat.includes('investment') || cat.includes('job') || cat.includes('business');
      })
      .attr('stroke', d => colorScale(d[0]))
      .attr('stroke-width', 4);

    // Restore TARGET LABELS to full color and extra weight
    d3.selectAll('.line-label')
      .filter(function(d) {
        // Look inside both standard structures just in case data format varies
        if (!d) return false;
        const rawString = d.data && d.data[0] ? d.data[0] : (d[0] ? d[0] : '');
        if (!rawString) return false;
        
        const cat = rawString.toLowerCase();
        return cat.includes('investment') || cat.includes('job') || cat.includes('business');
      })
      .attr('fill', d => d.data ? colorScale(d.data[0]) : colorScale(d[0]))
      .style('font-weight', '700')
      .style('opacity', 1); // 🔴 Reinforce full opacity on your target highlights
  }

  return; // Prevent execution from bleeding into the registry tracker
}

const stateName = element.dataset.state;
  const chart     = chartRegistry[chartId];
  
  if (!chart || !chart[stateName]) return;
  if (chart._currentState === stateName) return;
  
  chart._currentState = stateName;
  chart.applyStep(stateName, chart[stateName].data, true);
}

window.addEventListener('resize', scroller.resize);