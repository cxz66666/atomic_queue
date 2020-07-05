"use strict";

// Copyright (c) 2019 Maxim Egorushkin. MIT License. See the full licence in file LICENSE.

$(function() {
    const spsc_pattern = { pattern: {
        path: {
            d: 'M 0 0 L 10 10 M 9 -1 L 11 1 M -1 9 L 1 11',
            strokeWidth: 4
        },
        width: 10,
        height: 10,
        opacity: 1
    }};

    const settings = {
     "boost::lockfree::spsc_queue": [$.extend(true, {pattern: {color: '#8E44AD'}}, spsc_pattern),  0],
   "moodycamel::ReaderWriterQueue": [$.extend(true, {pattern: {color: '#BA4A00'}}, spsc_pattern),  1],
                "pthread_spinlock": ['#58D68D',  2],
                      "std::mutex": ['#239B56',  3],
                 "tbb::spin_mutex": ['#3498DB',  4],
   "tbb::concurrent_bounded_queue": ['#9ACCED',  5],
          "boost::lockfree::queue": ['#AA73C2',  6],
     "moodycamel::ConcurrentQueue": ['#BA4A00',  7],
     "xenium::michael_scott_queue": ['#73C6B6',  8],
         "xenium::ramalhete_queue": ['#45B39D',  9],
    "xenium::vyukov_bounded_queue": ['#16A085', 10],
                     "AtomicQueue": ['#FFFF00', 11],
                    "AtomicQueueB": ['#FFFF40', 12],
                    "AtomicQueue2": ['#FFFF80', 13],
                   "AtomicQueueB2": ['#FFFFBF', 14],
             "OptimistAtomicQueue": ['#FF0000', 15],
            "OptimistAtomicQueueB": ['#FF4040', 16],
            "OptimistAtomicQueue2": ['#FF8080', 17],
           "OptimistAtomicQueueB2": ['#FFBFBF', 18]
    };

    function latency_to_series(results) {
        const series = Array.from(Object.entries(results)).map(entry => {
            const name = entry[0];
            const value = entry[1];
            const s = settings[name];
            return {
                name: name,
                color: s[0],
                index: s[1],
                data: [{y: Math.round(value * 1e9), x: s[1]}]
            };
        });
        series.sort((a, b) => { return a.index - b.index; });
        series.forEach((element, index) => {
            element.index = index;
            element.data[0].x = index;
        });
        const categories = series.map(s => { return s.name; });
        return [series, categories];
    }

    function plot_scalability(div_id, results, title_suffix, max_lin, max_log) {
        const modes = [
            {type: 'linear', title: { text: 'throughput, msg/sec (linear scale)'}, max: max_lin, min: 0 },
            {type: 'logarithmic', title: { text: 'throughput, msg/sec (logarithmic scale)'}, max: max_log, min: 100e3},
        ];
        let mode = 0;

        const series = [];
        for(const [name, stats] of Object.entries(results)) {
            const s = settings[name];
            series.push({
                name: name,
                color: s[0],
                index: s[1],
                type: "column",
                data: stats.map(a => [a[0], a[3]]),
                atomic_queue_stats: stats
            });
            series.push({
                name: name,
                color: s[0],
                index: s[1],
                type: "errorbar",
                data: stats.map(a => [a[0], a[1], a[2]])
            });
        }

        const tooltips = []; // Build a tooltip once and then reuse it.
        const tooltip_formatter = function() {
            const threads = this.x;
            let tooltip = tooltips[threads];
            if(!tooltip) {
                const data = [];
                for(let i = 0; i < this.points.length; i += 2) {
                    const p = this.points[i];
                    const stats = p.series.options.atomic_queue_stats[p.point.index];
                    data[p.series.options.index] = {
                        name: p.series.name,
                        color: p.series.color,
                        min: Highcharts.numberFormat(stats[1], 0),
                        max: Highcharts.numberFormat(stats[2], 0),
                        mean: Highcharts.numberFormat(stats[3], 0),
                        stdev: Highcharts.numberFormat(stats[4], 0)
                    };
                }

                let html = `<span class="tooltip_scalability_title">${threads} producers, ${threads} consumers</span>`;
                html += '<table class="tooltip_scalability"><tr><th></th><th>mean</th><th>stdev</th><th>min</th><th>max</th></tr>';
                for(const d of data)
                    if(d)
                        html += `<tr><td style="color: ${d.color}">${d.name}: </td><td><strong>${d.mean}</strong></td><td><strong>${d.stdev}</strong></td><td>${d.min}</td><td>${d.max}</td></tr>`;
                html += '</table>';

                tooltip = html;
                tooltips[threads] = tooltip;
            }
            return tooltip;
        }

        const chart = Highcharts.chart(div_id, {
            chart: {
                events: {
                    click: function() {
                        mode ^= 1;
                        chart.yAxis[0].update(modes[mode]);
                    }
                }
            },
            title: { text: 'Scalability on ' + title_suffix },
            subtitle: { text: "click on the chart background to switch between linear and logarithmic scales" },
            xAxis: {
                title: { text: 'number of producers, number of consumers' },
                tickInterval: 1
            },
            yAxis: modes[mode],
            tooltip: {
                followPointer: true,
                shared: true,
                useHTML: true,
                formatter: tooltip_formatter
            },
            series: series
        });
    }

    function plot_latency(div_id, series_categories, title_suffix) {
        const [series, categories] = series_categories;
        Highcharts.chart(div_id, {
            chart: { type: 'bar' },
            plotOptions: {
                series: { stacking: 'normal'},
                bar: { dataLabels: { enabled: true, align: 'left', inside: false } }
            },
            title: { text: 'Latency on ' + title_suffix },
            xAxis: { categories: categories },
            yAxis: { title: { text: 'latency, nanoseconds/round-trip' }, max: 800 },
            tooltip: { valueSuffix: ' nanoseconds' },
            series: series
        });
    }

    const scalability_9900KS = {"AtomicQueue": [[1, 52660493, 286258811, 74231130, 46923128], [2, 11670323, 12511844, 12011858, 270810], [3, 9791407, 10870735, 10354387, 423144], [4, 8124141, 8262334, 8192020, 23767], [5, 7882302, 8164594, 8058345, 45565], [6, 7536832, 7993441, 7709403, 113618], [7, 7011413, 8020563, 7552220, 427030], [8, 6291117, 7515622, 6885968, 545237]], "AtomicQueue2": [[1, 22787102, 61696929, 23153888, 2262406], [2, 11251529, 12267302, 11657086, 212493], [3, 9250720, 10001213, 9472512, 131865], [4, 7958528, 8157226, 8055508, 33266], [5, 7784153, 8097440, 7972636, 61800], [6, 7450035, 7952026, 7641924, 130961], [7, 7005546, 7995642, 7509325, 381599], [8, 6349759, 7441272, 6854003, 471089]], "AtomicQueueB": [[1, 42613077, 228034973, 48968374, 17271281], [2, 11307287, 12122517, 11654762, 192294], [3, 9978460, 11117123, 10580691, 418664], [4, 7820303, 8149391, 8038875, 49723], [5, 7393617, 7922868, 7706848, 116543], [6, 7044646, 7623977, 7432887, 119697], [7, 6771050, 7812016, 7300722, 426304], [8, 6167485, 7214447, 6685564, 449080]], "AtomicQueueB2": [[1, 31747483, 44550020, 34684489, 1949026], [2, 11004660, 11624801, 11264944, 159388], [3, 9311302, 9898647, 9585552, 81750], [4, 7583514, 8026821, 7885529, 68419], [5, 7318917, 7806120, 7600268, 122098], [6, 7004711, 7518179, 7348211, 105453], [7, 6760542, 7775829, 7294366, 408721], [8, 6203358, 7175857, 6682430, 396215]], "OptimistAtomicQueue": [[1, 487380322, 829842979, 661556071, 100346674], [2, 31797501, 32761745, 32437895, 262498], [3, 36537452, 37548890, 37008138, 364848], [4, 39195547, 39453579, 39332552, 57506], [5, 37390896, 48677211, 44454166, 2490283], [6, 41443858, 50559092, 46326029, 3930139], [7, 43825547, 53156863, 48061575, 3621601], [8, 46177415, 50602252, 47828080, 1452954]], "OptimistAtomicQueue2": [[1, 25703634, 682547965, 230538256, 211766068], [2, 21661800, 29516399, 24851671, 1493004], [3, 29291342, 33834235, 30273240, 524342], [4, 32920458, 36241653, 33343018, 441670], [5, 36830993, 43357072, 38976054, 1862089], [6, 39747081, 49741386, 44704047, 4504426], [7, 42479711, 51839802, 46362844, 3648632], [8, 43732450, 49877392, 46347786, 2371894]], "OptimistAtomicQueueB": [[1, 75661057, 738447042, 124305321, 83621261], [2, 31477141, 32474220, 32144227, 176354], [3, 36019269, 37037279, 36563374, 322208], [4, 38357209, 38905937, 38647013, 72549], [5, 36246828, 47608460, 43165102, 2491292], [6, 39494986, 49368578, 44976208, 4044505], [7, 41252863, 51655899, 46076590, 4108616], [8, 43899112, 49215349, 46213653, 1857294]], "OptimistAtomicQueueB2": [[1, 31441458, 495211858, 59246349, 27593701], [2, 21826376, 29825513, 26058597, 2081213], [3, 28756903, 34057706, 29794288, 839909], [4, 31084544, 33672715, 32858135, 485076], [5, 33366524, 40347303, 36955446, 2416293], [6, 36837801, 42786274, 39860539, 2457925], [7, 39946444, 45751323, 42359860, 2112179], [8, 41740252, 46736438, 43950268, 1704291]], "boost::lockfree::queue": [[1, 6746684, 8277185, 7092878, 418709], [2, 7312023, 7803259, 7553075, 87733], [3, 7263517, 7648842, 7476500, 91860], [4, 6359882, 7098293, 6610597, 192715], [5, 6367348, 6773852, 6457372, 46054], [6, 5927503, 6298061, 6055700, 68494], [7, 5746691, 6154693, 5964947, 83543], [8, 5331463, 5801836, 5535251, 89204]], "boost::lockfree::spsc_queue": [[1, 64923339, 78317500, 69086959, 2160846]], "moodycamel::ConcurrentQueue": [[1, 20190901, 29453011, 24985741, 1594915], [2, 14337151, 52431952, 16261043, 4078346], [3, 15291705, 43648056, 17046353, 4143492], [4, 15736506, 45837232, 18228886, 5125409], [5, 16888207, 47841058, 19245549, 5379950], [6, 16998837, 63384866, 20186438, 6382091], [7, 17716036, 66347129, 21038132, 6921929], [8, 17924728, 64375322, 22382013, 8285161]], "moodycamel::ReaderWriterQueue": [[1, 43356419, 538733018, 256503633, 185340411]], "pthread_spinlock": [[1, 23507277, 29932694, 27413691, 1797342], [2, 14270085, 18312194, 16382070, 769144], [3, 8211868, 12289865, 10189163, 1848412], [4, 6395961, 9383867, 7773828, 1275888], [5, 8442872, 10466994, 9009726, 423856], [6, 8112952, 9328919, 8527056, 234738], [7, 7189956, 8492547, 7685023, 190137], [8, 6576974, 7596251, 6917365, 230403]], "std::mutex": [[1, 5006882, 9199394, 6838493, 652022], [2, 4687459, 6598427, 5749404, 387982], [3, 4580302, 6900299, 5685428, 464037], [4, 4941923, 7100935, 6086683, 325998], [5, 5151696, 6739344, 5986755, 186929], [6, 5521016, 6571707, 5918632, 116062], [7, 5532592, 6378700, 5826170, 88618], [8, 5438188, 6181434, 5704761, 76268]], "tbb::concurrent_bounded_queue": [[1, 10925661, 14807665, 13187267, 1088087], [2, 12352037, 15166768, 13521906, 612838], [3, 11099805, 12535211, 11630738, 279433], [4, 9929811, 10656023, 10303443, 177287], [5, 9349138, 10217187, 9704186, 183365], [6, 8548656, 9516659, 8863967, 196987], [7, 7358384, 8693321, 7958661, 218257], [8, 6615544, 8013655, 7136724, 350688]], "tbb::spin_mutex": [[1, 32588344, 41937261, 36432718, 2291145], [2, 17753221, 21806602, 19845873, 1357076], [3, 7201937, 11563566, 9346899, 1335282], [4, 2900531, 6495310, 4753237, 1579671], [5, 5103017, 5929302, 5552236, 189032], [6, 4254932, 5441256, 4834876, 480630], [7, 4223732, 4907625, 4560981, 246626], [8, 3338874, 4286720, 4138009, 129870]], "xenium::michael_scott_queue": [[1, 8417342, 10161353, 9493893, 327033], [2, 8230532, 8706024, 8488596, 76740], [3, 7071683, 7702336, 7404448, 172642], [4, 6177715, 6500382, 6329812, 50090], [5, 6227656, 6844074, 6487028, 190493], [6, 6408222, 7118668, 6666732, 183381], [7, 6220683, 6728490, 6410011, 115700], [8, 5906991, 6324097, 6072896, 89071]], "xenium::ramalhete_queue": [[1, 26889784, 33285933, 31963600, 729718], [2, 22883173, 24719839, 23562698, 341416], [3, 28121330, 29464259, 28838631, 366336], [4, 33312793, 34047588, 33650956, 184508], [5, 31808107, 38717573, 34327553, 2297341], [6, 33560480, 40481895, 36597565, 2593281], [7, 34734954, 42470849, 38204151, 3109357], [8, 35105293, 44944634, 39750343, 4246943]], "xenium::vyukov_bounded_queue": [[1, 60523731, 122827707, 104853037, 23546237], [2, 17367563, 29204433, 25098906, 2910703], [3, 14333973, 16468857, 15718588, 266421], [4, 11678227, 12747022, 12409949, 196985], [5, 10112556, 11532118, 11083680, 290177], [6, 9709516, 12829017, 10969926, 1069776], [7, 9061926, 10421370, 9652587, 457388], [8, 8187699, 8591244, 8371133, 91811]]};
    const scalability_xeon_gold_6132 = {"AtomicQueue": [[1, 8058966, 85486744, 19861417, 13465781], [2, 2774121, 5150399, 3716822, 529166], [3, 2234209, 3581321, 2844019, 297103], [4, 2189691, 2797820, 2500767, 141748], [5, 2000160, 2556556, 2239114, 108475], [6, 1800361, 2193952, 1967523, 85069], [7, 1339017, 2052080, 1747440, 113355], [8, 499239, 1790395, 1251368, 376126], [9, 457147, 1554831, 1065501, 317655], [10, 499701, 1497940, 933685, 296414], [11, 471438, 1317111, 758521, 284702], [12, 472731, 1223669, 645847, 211406], [13, 475966, 1051905, 607384, 154227], [14, 447298, 915959, 542223, 81608]], "AtomicQueue2": [[1, 6014132, 112250995, 11860821, 13520637], [2, 2828684, 4803110, 3861060, 547933], [3, 2370797, 3402752, 2907770, 290882], [4, 2198966, 2893203, 2481239, 168783], [5, 1922906, 2473517, 2215197, 120928], [6, 1700174, 2163119, 1957391, 98690], [7, 1584156, 1904525, 1752509, 71870], [8, 497167, 1692471, 1211725, 399956], [9, 492465, 1637918, 1032783, 355535], [10, 498320, 1502601, 894903, 322686], [11, 496862, 1287595, 740572, 255373], [12, 479471, 1142817, 669465, 220449], [13, 490420, 1087423, 564978, 132699], [14, 484859, 853987, 561566, 95000]], "AtomicQueueB": [[1, 11312440, 21089399, 14319386, 2322974], [2, 2828641, 4395539, 3598695, 363396], [3, 2383683, 3335368, 2837469, 222254], [4, 2194149, 2838158, 2479930, 155470], [5, 1961892, 2545450, 2206488, 124696], [6, 1704523, 2207219, 1965343, 113058], [7, 1400922, 2184936, 1760002, 125320], [8, 498481, 1680613, 1093922, 406887], [9, 495736, 1581164, 956214, 328532], [10, 498850, 1444846, 840343, 308105], [11, 483922, 1277870, 700261, 269404], [12, 487609, 1134736, 616528, 192809], [13, 494557, 857638, 544687, 81207], [14, 483041, 850197, 558294, 95879]], "AtomicQueueB2": [[1, 7460755, 14951085, 10960441, 1884733], [2, 2741293, 4471488, 3421984, 442894], [3, 2351790, 3354557, 2754730, 237182], [4, 2126512, 2763650, 2451035, 148674], [5, 2033646, 2434559, 2185096, 106060], [6, 1749020, 2318698, 1968299, 112029], [7, 1352736, 1922994, 1752021, 107017], [8, 479497, 1649868, 1094885, 411721], [9, 486573, 1566955, 964595, 345537], [10, 498586, 1511963, 858856, 312525], [11, 484384, 1295858, 693007, 252815], [12, 491452, 1155658, 619410, 194677], [13, 442994, 1058050, 576966, 133949], [14, 469414, 882437, 539996, 70095]], "OptimistAtomicQueue": [[1, 56698745, 429583640, 175629468, 86409817], [2, 6408754, 11931110, 8798271, 1427113], [3, 8066359, 13129768, 10458901, 1514753], [4, 8298306, 13581897, 11250748, 1640968], [5, 8932051, 13944639, 12365031, 1196775], [6, 9446462, 14000610, 12900019, 1207077], [7, 9778505, 14314352, 13477473, 850012], [8, 9215134, 11865416, 10467114, 722175], [9, 8102279, 11617885, 10064154, 979170], [10, 7755919, 11379025, 10007986, 1069232], [11, 7809733, 11642631, 10059359, 1147829], [12, 7678745, 11785406, 10015423, 1121277], [13, 7891823, 11650001, 9852053, 1038603], [14, 7931500, 12177433, 9759040, 1154347]], "OptimistAtomicQueue2": [[1, 13352047, 166577270, 79006910, 30513135], [2, 5809820, 10117510, 7296714, 983486], [3, 7359997, 12559722, 9306742, 1644149], [4, 7729367, 12734246, 10474524, 1667974], [5, 8256529, 13316977, 11173176, 1704466], [6, 8427196, 13658790, 12145214, 1423602], [7, 8972407, 13954602, 12800483, 941189], [8, 8306345, 11031293, 10007828, 701969], [9, 7781010, 11330468, 9562517, 884767], [10, 7270803, 10842898, 9535466, 1017074], [11, 7306288, 11400679, 9630510, 1113066], [12, 7615179, 10905131, 9599169, 993126], [13, 7768507, 10951419, 9495167, 927146], [14, 7939789, 11593058, 9363004, 1002168]], "OptimistAtomicQueueB": [[1, 18005087, 461920680, 43299949, 58590278], [2, 7918458, 13244281, 10554149, 1412045], [3, 8566563, 13834992, 11664903, 1605994], [4, 8776970, 13733282, 12143773, 1339924], [5, 9080446, 14486100, 12540476, 1136728], [6, 9031510, 14144692, 12968928, 1144476], [7, 10260978, 14264523, 13401276, 578048], [8, 7860310, 11677713, 10338906, 733228], [9, 8037599, 11536671, 10046625, 980055], [10, 7666387, 11483247, 9974741, 1077884], [11, 7773342, 11518370, 10097099, 1148028], [12, 7708761, 11962418, 10143672, 1169123], [13, 7725882, 11194790, 9873433, 1054815], [14, 7855188, 11275014, 9646028, 1118131]], "OptimistAtomicQueueB2": [[1, 11400233, 27116940, 21484544, 4456865], [2, 6565091, 11622771, 9409379, 1434258], [3, 7435746, 12559877, 10522656, 1516744], [4, 7776622, 12750010, 10260559, 1589501], [5, 7964167, 13270039, 11437117, 1346754], [6, 8849023, 13722187, 11756287, 1234538], [7, 8997751, 13835002, 12188309, 1192711], [8, 7756541, 10713723, 9591582, 747240], [9, 7314675, 11263412, 9209092, 948300], [10, 7352487, 10748888, 9264018, 1017641], [11, 7141749, 10896155, 9260621, 1076754], [12, 7063191, 10471776, 9248261, 984638], [13, 7358863, 10459869, 9071272, 961738], [14, 7490258, 10858481, 8986939, 1056811]], "boost::lockfree::queue": [[1, 1934482, 3335118, 2968513, 267417], [2, 2020556, 2714547, 2380363, 166177], [3, 1766944, 2481333, 2277536, 154223], [4, 1927815, 2468139, 2215008, 117101], [5, 1913080, 2341598, 2154795, 109277], [6, 1737937, 2239840, 2067750, 101330], [7, 1685532, 2158493, 1965928, 102944], [8, 476300, 1588449, 1057234, 312540], [9, 504256, 1466335, 882380, 236710], [10, 495183, 1249404, 733720, 210184], [11, 496163, 1173368, 615041, 163022], [12, 483550, 1080338, 576774, 125017], [13, 479449, 942173, 552191, 90608], [14, 444801, 789696, 538890, 64254]], "boost::lockfree::spsc_queue": [[1, 21589958, 35612264, 26701941, 3432048]], "moodycamel::ConcurrentQueue": [[1, 5031299, 13152497, 7231628, 2054206], [2, 3106244, 21840508, 5669989, 2480503], [3, 4039871, 18242902, 7384110, 3603375], [4, 4487792, 21071736, 8181695, 3838323], [5, 5209580, 24290350, 9672263, 5127482], [6, 5202954, 24160723, 8472347, 4567541], [7, 5415473, 26165080, 9754203, 5527832], [8, 4290069, 18526789, 7646915, 3740996], [9, 4479809, 35353993, 7585632, 6194437], [10, 4727037, 23405328, 7617742, 4615300], [11, 4631325, 30337177, 8709014, 6268210], [12, 4473005, 27300920, 8026322, 5175124], [13, 4555975, 27789293, 8331006, 5575842], [14, 4102221, 43489396, 11921415, 9787758]], "moodycamel::ReaderWriterQueue": [[1, 12713140, 254602528, 122153284, 81114699]], "pthread_spinlock": [[1, 4306958, 8535650, 5905333, 840994], [2, 2839333, 4736775, 4053457, 456568], [3, 2548628, 3614912, 3201805, 248819], [4, 2087992, 2959824, 2605329, 165780], [5, 1983329, 2542321, 2248467, 138984], [6, 1783286, 2276326, 1986022, 112386], [7, 1536216, 2018246, 1766854, 112798], [8, 507415, 1499893, 1072692, 193480], [9, 501385, 1152617, 766700, 218876], [10, 489327, 1025270, 609721, 149499], [11, 497072, 858980, 604787, 120507], [12, 475489, 849693, 593343, 102672], [13, 463691, 888711, 574088, 96224], [14, 373441, 833012, 549424, 69983]], "std::mutex": [[1, 442267, 6858037, 5283864, 1863950], [2, 4162864, 4959039, 4478520, 180618], [3, 2575706, 3420067, 2946085, 152139], [4, 2601420, 3137460, 2858986, 96306], [5, 3392974, 3797099, 3577014, 80921], [6, 4370258, 4891290, 4579916, 108823], [7, 4837222, 6248120, 5845232, 326581], [8, 4675007, 7221265, 6303575, 552163], [9, 4517060, 6675754, 5604113, 611225], [10, 4450885, 6593358, 5396274, 618943], [11, 4666608, 6758794, 5363476, 530564], [12, 4662177, 7071927, 5362666, 566952], [13, 4496056, 7270498, 5446862, 629130], [14, 4471558, 7214091, 5489034, 703952]], "tbb::concurrent_bounded_queue": [[1, 2741938, 6390144, 4991431, 1081767], [2, 3694771, 5634833, 5092675, 420218], [3, 3475746, 4391484, 4044394, 228584], [4, 2964563, 3890751, 3477907, 203006], [5, 2600081, 3341203, 3069347, 157629], [6, 2448135, 3072604, 2752748, 131448], [7, 2331329, 2770486, 2526461, 106497], [8, 1032645, 2367531, 1609048, 398019], [9, 768399, 2133918, 1378943, 297095], [10, 886747, 1960986, 1287592, 241557], [11, 852994, 1572988, 1213625, 141077], [12, 905349, 1536817, 1207538, 119201], [13, 672137, 1425158, 1150131, 125239], [14, 568180, 1255046, 1002357, 146505]], "tbb::spin_mutex": [[1, 21210988, 25406844, 23208893, 942349], [2, 7466066, 15461111, 13086723, 1647857], [3, 6548025, 10474300, 8916823, 708177], [4, 3503017, 7794311, 6294651, 966794], [5, 2153878, 5637630, 4544841, 631651], [6, 1922531, 4200007, 3254751, 437747], [7, 1534161, 2793915, 2246670, 284381], [8, 767030, 1603044, 1236223, 188171], [9, 664685, 1136499, 875213, 112513], [10, 503884, 920905, 710065, 93160], [11, 429966, 825839, 612632, 95126], [12, 328981, 741818, 536929, 89893], [13, 360477, 620612, 498964, 64207], [14, 343378, 562153, 446904, 49826]], "xenium::michael_scott_queue": [[1, 1770874, 4922580, 3393287, 798045], [2, 1987279, 3672290, 2760207, 374957], [3, 2000056, 2824672, 2385886, 152176], [4, 1827185, 2416437, 2127391, 115719], [5, 1702595, 2145286, 1919895, 91485], [6, 1536137, 1930985, 1748041, 79961], [7, 1426820, 1834610, 1643576, 81903], [8, 498697, 1628919, 1118063, 276128], [9, 452869, 1380436, 834411, 255185], [10, 494632, 1118414, 682696, 203418], [11, 490195, 1028229, 585071, 155611], [12, 484824, 889727, 574498, 120673], [13, 497397, 848913, 548659, 87463], [14, 498987, 845423, 541580, 77173]], "xenium::ramalhete_queue": [[1, 3243963, 16649455, 9804049, 4323515], [2, 4857860, 10891091, 6531145, 1101794], [3, 5681860, 10963393, 7152903, 886425], [4, 6453166, 11687397, 8090624, 1227694], [5, 7515932, 11465916, 8472107, 1003833], [6, 7603204, 11843149, 8816720, 1186933], [7, 7778687, 11444208, 8969099, 1200481], [8, 6620873, 8934784, 7893553, 554709], [9, 7110063, 8505487, 7938195, 307016], [10, 7332561, 8873905, 8083197, 302364], [11, 7650290, 8835820, 8195968, 282168], [12, 7663185, 8824693, 8282478, 271141], [13, 7786817, 9767663, 8710633, 459364], [14, 7888409, 11483491, 9499927, 1182102]], "xenium::vyukov_bounded_queue": [[1, 6620293, 58918128, 36338730, 16662346], [2, 3698951, 10319122, 6978079, 1806086], [3, 3321190, 5064399, 4427496, 329624], [4, 3526724, 4346643, 3923541, 164522], [5, 3316072, 3924131, 3551537, 117605], [6, 3114542, 3481877, 3279592, 91098], [7, 2784557, 3242623, 3020950, 108825], [8, 1278721, 2800348, 1844408, 521532], [9, 1103213, 2357968, 1486304, 324785], [10, 1025767, 1973106, 1342701, 256232], [11, 732921, 1613235, 1194292, 156458], [12, 494928, 1408766, 1053087, 242590], [13, 479926, 1216268, 994219, 184954], [14, 433322, 1122701, 804412, 232255]]};
    const latency_9900KS = {"AtomicQueue":0.000000157,"AtomicQueue2":0.000000173,"AtomicQueueB":0.000000171,"AtomicQueueB2":0.000000175,"OptimistAtomicQueue":0.000000148,"OptimistAtomicQueue2":0.000000167,"OptimistAtomicQueueB":0.00000014,"OptimistAtomicQueueB2":0.000000149,"boost::lockfree::queue":0.00000031,"boost::lockfree::spsc_queue":0.000000129,"moodycamel::ConcurrentQueue":0.000000208,"moodycamel::ReaderWriterQueue":0.00000011,"pthread_spinlock":0.000000226,"std::mutex":0.000000411,"tbb::concurrent_bounded_queue":0.000000268,"tbb::spin_mutex":0.000000246,"xenium::michael_scott_queue":0.000000357,"xenium::ramalhete_queue":0.000000255,"xenium::vyukov_bounded_queue":0.000000183};
    const latency_xeon_gold_6132 = {"AtomicQueue":0.000000231,"AtomicQueue2":0.000000307,"AtomicQueueB":0.000000344,"AtomicQueueB2":0.000000403,"OptimistAtomicQueue":0.000000283,"OptimistAtomicQueue2":0.000000315,"OptimistAtomicQueueB":0.000000321,"OptimistAtomicQueueB2":0.000000345,"boost::lockfree::queue":0.000000726,"boost::lockfree::spsc_queue":0.000000269,"moodycamel::ConcurrentQueue":0.000000427,"moodycamel::ReaderWriterQueue":0.000000207,"pthread_spinlock":0.000000623,"std::mutex":0.000001859,"tbb::concurrent_bounded_queue":0.000000565,"tbb::spin_mutex":0.000000561,"xenium::michael_scott_queue":0.000000733,"xenium::ramalhete_queue":0.000000494,"xenium::vyukov_bounded_queue":0.000000436};
    plot_scalability('scalability-9900KS-5GHz', scalability_9900KS, "Intel i9-9900KS (core 5GHz / uncore 4.7GHz)", 60e6, 1000e6);
    plot_scalability('scalability-xeon-gold-6132', scalability_xeon_gold_6132, "Intel Xeon Gold 6132 (stock)", 15e6, 300e6);
    plot_latency('latency-9900KS-5GHz', latency_to_series(latency_9900KS), "Intel i9-9900KS (core 5GHz / uncore 4.7GHz)");
    plot_latency('latency-xeon-gold-6132', latency_to_series(latency_xeon_gold_6132), "Intel Xeon Gold 6132 (stock)");
});
