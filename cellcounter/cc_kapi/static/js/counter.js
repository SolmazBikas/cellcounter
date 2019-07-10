/*global $:false, jQuery:false */
var abnormal = false;
var keyboard_active = false;
var img_displayed = false;
var doughnut = {};
var pie = {};
var arc = {};
var cell_types = {};
var size = 200;
var editing_keyboard = false;
var first_count = true;
var edit_cell_id = -1;
var selected_element = {};
var date_now = new Date(Date.now()).toISOString();
var keyboard_map = {"label": "Default", "is_primary": true, "created": date_now,
                    "last_modified": date_now, "mappings": []};
var chart, chart2;


/* Counter object */

var counter = (function() {
    var undo_history = [];
    var count_data = [];

    return {
      init: function () {
        /* Load cell_types object, and create and load new count_data object
         * provides error message should loading of data fail.
         * Returns a Deferred object for promise chaining. */
        return $.getJSON("/api/cell_types/", function(data) {
            "use strict";
            cell_types = {};
            $.each(data, function(key, cell) {
                cell.box = [];
                cell_types[cell.id] = cell;
            });
        }).done(function() {
            "use strict";
            /* Loads an empty count_data array */
            var cell_order = ['blasts','promyelocytes','myelocytes','meta','neutrophils','monocytes','basophils',
                'eosinophils','lymphocytes','plasma_cells','erythroid','other','lymphoblasts'];

            for (var i=0; i < cell_order.length; i++) {
                for (var cell in cell_types) {
                    if (cell_types.hasOwnProperty(cell)) {
                        if (cell_types[cell].machine_name === cell_order[i]) {
                            count_data.push({id: cell_types[cell].id,
                            count: 0,
                            abnormal: 0,
                            visualisation_colour: cell_types[cell].visualisation_colour,
                            readable_name: cell_types[cell].readable_name,
                            machine_name: cell_types[cell].machine_name});
                        }
                    }
                }
            }
        }).fail(function() {
            "use strict";
            add_alert('ERROR', 'Cellcountr failed to load cell data. Please refresh page');
        });
      },

      reset: function () {
        /* Reset all the count data and the undo history */
        "use strict";
        for (var i = 0; i < count_data.length; i++) {
            count_data[i].count = 0;
            count_data[i].abnormal = 0;
        }
        undo_history = [];
      },

      get_count_data: function () {
        /* XXX: to remove. Exposes private count_data structure - all access should be through a class method */
        return count_data;
      },

      increment: function (cell_type_id, abnormal) {
        console.log("Increment");
        if (abnormal === true) {
            for (j = 0; j < count_data.length; j++) {
                if (count_data[j].id === cell_type_id) {
                    count_data[j].abnormal++;
                }
            }
            undo_history.push({c_id: cell_type_id, c_type: 'abnormal'});
        } else {
            for (j = 0; j < count_data.length; j++) {
                if (count_data[j].id === cell_type_id) {
                    count_data[j].count++;
                }
            }
            undo_history.push({c_id: cell_type_id, c_type: 'count'});
        }

      },

      undo: function () {
        var last_key = undo_history.pop();
        if (typeof last_key !== "undefined") {
            var c_id = last_key.c_id;
            var c_type = last_key.c_type;

            for (i=0; i < count_data.length; i++) {
                if (count_data[i].id === c_id) {
                    if (count_data[i][c_type] > 0 ) {
                        count_data[i][c_type]--;
                    }
                }
            }
            return c_id;
        } else {
            /* Nothing to delete */
            undo_history = [];
        }
      },

      get_counts: function (cell_id) {
        var count_normal;
        var count_abnormal;

        for (k=0; k < count_data.length; k++) {
            if (count_data[k].id === cell_id) {
                count_normal = count_data[k].count;
                count_abnormal = count_data[k].abnormal;
            }
        }
        return {
            normal: count_normal,
            abnormal: count_abnormal
        };
      },

      get_total: function () {
        // TODO: optimise by keeping a running total
        var total = 0;
        for (var i=0; i < count_data.length; i++) {
            total += count_data[i].count;
            total += count_data[i].abnormal;
        }
        return total;
      }

    };
})();

function init_objects() {
    chart = doughnutChart('#doughnut').data(counter.get_count_data());
    chart2 = doughnutChart('#doughnut2').data(counter.get_count_data());
}

function init_keyboard() {
    $('.keyboard-label').editable({
        url: function(params) {
            var keyboard = load_keyboard(params.pk);
            keyboard.label = params.value;
            save_keyboard(keyboard);
        }
    });

    $('#save_new_name').click(function() {
        save_new_keyboard($('#keyboard-name-input').val());
    });
    // Re-enable keyboard when dialog is closed
    $('#keyboard_name').on('hide', function () {
        editing_keyboard = true;
        keyboard_active = true;
    });

    $('#select_button').on('click', function() {
        $("#select-keyboard").modal("show");
    });

    $('#select-keyboard').on('show', function() {
        $.getJSON("/api/keyboards/", function(data) {
            $('#keyboard_list tbody > tr').remove();
            $.each(data, function(i, data) {
                $('#keyboard_list table tbody').append(
                    '<tr><td>'+data.label+'</td><td><span class="btn btn-success load_keyboard" title="Select keyboard" data-id="' + data.id + '"><i class="icon-ok icon-white"></i></span></td></tr>');
            });
            $('.load_keyboard').on('click', function() {
                var id = ($(this).attr('data-id'));
                set_keyboard(load_keyboard(id));
                $('#select-keyboard').modal("hide");
                $("div#editkeymapbox").dialog("close");
            });
        });
    });
}


function init_other() {
    var i, j, k;

    $('#edit_button').on('click', edit_keyboard);

    register_resets();

    $('#fuzz, #close_button').click(function () {

        if (editing_keyboard) {
            return;
        }

        if (keyboard_active) {
            keyboard_active = false;

            var count_data = counter.get_count_data(); // XXX

            for (i=0; i < count_data.length; i++) {
                $("#id_"+i+"-normal_count").prop("value", count_data[i].count);
                $("#id_"+i+"-abnormal_count").prop("value", count_data[i].abnormal);
            }

            var total = counter.get_total();

            if (total > 0) {
                log_stats(total);
                display_stats(total);
            }

            $('#counterbox').slideUp('slow', function () {
                $('#fuzz').fadeOut('slow', function () {
                });
            });

            if (first_count === true) {
                var keyboard_selector = $("#keyboard-buttons");
                keyboard_selector.append("<div id='openkeyboard' class='btn btn-success btn-large'>Continue counting</div>");
                $('#openkeyboard').on('click', open_keyboard);
                keyboard_selector.append("<div class='btn btn-large btn-danger reset_button restart_button' style='margin-left: 5px'>Reset counters</div>");
                register_resets();
                first_count = false;
            }
        }
    });

    //Adjust height of overlay to fill screen when browser gets resized
    $(window).bind("resize", function (){
        $("#fuzz").css("height", $(document).height());
        //$("#fuzz").css("top", $(window).top());

        if (keyboard_active) {
            resize_keyboard($("div#content").width());
        }
    });

    jQuery(document).bind('keydown', function (e) {
        var key, code, shift_pressed, el, enter=false;
        var alpha = false, up = false, down = false;

        console.log("Keydown");

        if (keyboard_active) {
            key = String.fromCharCode(e.which).toUpperCase();
            code = e.which;
            shift_pressed = e.shiftKey;

            console.log(key);

            if (/[a-z]/i.test(key) && !shift_pressed) {
                alpha = true;
            }
            if (code === 188) {
                key = ","; // XXX: WTF
            }
            if (code === 173) {
                key = "-"; // XXX: WTF
            }
            if (key === " ") {
                abnormal = true;
                return false;
            }
            else if (code === 13) {
                enter = true;
            }
            else if(code === 38) {
                up = true;
            }
            else if(code === 40) {
                down = true;
            }

            if(editing_keyboard) {
                if (enter) {
                    deselect_element(selected_element);
                    select_element(selected_element.next());
                    return;
                }
                else if (down) {
                    deselect_element(selected_element);
                    select_element(selected_element.next());
                    return false;
                }
                else if (up) {
                    deselect_element(selected_element);
                    el = selected_element.prev();
                    if (!$(el).html()) {
                        el = $("div#celllist").find("li").last();
                    }
                    select_element(el);
                    return false;
                } else if (alpha) {
                    if (cell_types.hasOwnProperty(edit_cell_id.toString())) {
                        if($("#multi_key").is(':checked')) {
                            /* DENIES ABILITY TO MAP MULTIPLE KEYS TO THE SAME CELL TYPE
                             * Iterate through all key mappings, looking for any which map to the current cell_id.
                             * If found, delete them. N.B. we decrement the iterator if we've spliced to avoid
                             * issues with the length of the array and correct iteration position.
                             */
                            for (i = 0; i < keyboard_map.mappings.length; i++) {
                                if (keyboard_map.mappings[i].cellid.toString() === edit_cell_id) {
                                    keyboard_map.mappings.splice(i, 1);
                                    i--;
                                }
                            }
                            /* Remove any previous mappings for the key we're trying to add - prevents assigning
                             * two celltypes to a given key.
                             */
                            for (i = 0; i < keyboard_map.mappings.length; i++) {
                                if (keyboard_map.mappings[i].key === key.toLowerCase()) {
                                    keyboard_map.mappings.splice(i, 1);
                                    i--;
                                }
                            }

                            /* Add the new mapping for this keypress */
                            keyboard_map.mappings.push({'cellid': parseInt(edit_cell_id), 'key': key.toLowerCase()});

                            if($("#auto_advance").is(':checked')) {
                                deselect_element(selected_element);
                                select_element(selected_element.next());
                            }

                        } else {
                            /* We allow multiple mappings to the same cell_id , here we check if the key has been
                             * previously mapped, and if so, we remove any mappings for that key.
                             */
                            for (i = 0; i < keyboard_map.mappings.length; i++) {
                                if (keyboard_map.mappings[i].key === key.toLowerCase()) {
                                    keyboard_map.mappings.splice(i, 1);
                                    i--;
                                }
                            }

                            /* Add the new mapping */
                            keyboard_map.mappings.push({'cellid': parseInt(edit_cell_id), 'key': key.toLowerCase()});

                            /* Now we need to check that we have indeed mapped a key. If we haven't, it means we are
                             * creating a new map for a previously unmapped key, and therefore should just insert it
                             * into the mappings array.
                             */
                            var is_mapped = false;
                            for (i = 0; i < keyboard_map.mappings.length; i++) {
                                if (keyboard_map.mappings[i].key === key.toLowerCase() &&
                                    keyboard_map.mappings[i].cellid.toString() === edit_cell_id) {
                                    is_mapped = true;
                                }
                            }
                            if (is_mapped === false) {
                                keyboard_map.mappings.push({'cellid': parseInt(edit_cell_id), 'key': key.toLowerCase()});
                            }

                            if($("#auto_advance").is(':checked')) {
                                deselect_element(selected_element);
                                select_element(selected_element.next());
                            }
                        }
                        update_keyboard();
                    }
                }
                return;
            }

            if (shift_pressed) {
                /* We now show the image overlay to the user with the selected celltype images */
                for (i = 0; i < keyboard_map.mappings.length; i++) {
                    if (keyboard_map.mappings[i].key.toUpperCase() === key) {
                        var cell_id = keyboard_map.mappings[i].cellid;
                        var slug = cell_types[cell_id].machine_name;
                        var fullname = cell_types[cell_id].readable_name;

                        var $dialog = $('<div></div>')
                            .load('/images/celltype/'+slug+'/')
                            .dialog({
                                autoOpen: false,
                                title: fullname,
                                width: 900,
                                height: 700
                            });
                        /* Close any open dialogues before opening*/
                        $(".ui-dialog-content").dialog("close");
                        $dialog.dialog('open');
                        /* No further need to iterate through list */
                        break;
                    }
                }

            } else if (img_displayed) {
                $("div#imagebox").css("display", "none");
                img_displayed = false;
                return;
            }

            if (key === '1') {
                /* Show percentage view, note e.which is not working due to keypress issues */
                var total = counter.get_total();
                var count_data = counter.get_count_data(); // XXX

                for (i=0; i< count_data.length; i++) {
                    for (j=0; j< cell_types[count_data[i].id].box.length; j++) {
                        $(cell_types[count_data[i].id].box[j]).find("span.countval").text(
                            Math.floor((count_data[i].count + count_data[i].abnormal)/total * 100) + "%");
                        $(cell_types[count_data[i].id].box[j]).find("span.abnormal").text("");
                    }
                }
            }

            if (code === 8) {
                e.preventDefault();
                var cell_id = counter.undo();
                if(cell_id) update_key_display(cell_id);
            } else {
                for (i = 0; i < keyboard_map.mappings.length; i++) {
                    if (keyboard_map.mappings[i].key.toUpperCase() === key && !(shift_pressed)) {
                        var id = keyboard_map.mappings[i].cellid;

                        // Add highlighting to keyboard
                        // Remove all currently active highlights (stops a queue developing)
                        for (j=0; j<cell_types[id].box.length; j++){
                            $(cell_types[id].box[j]).stop(true, true).css("background-color", '#ffffff');
                        }

                        // Add highlight to typed key
                        $(cell_types[id].box).effect("highlight", {}, 200);

                        counter.increment(id, abnormal);
                        update_key_display(id);

                        /* No further need to iterate through list */
                        break;
                    }
                }
            }
            chart.render();
        }
    });

    jQuery(document).bind('keyup', function (e){
        var key, code;
        if (keyboard_active) {
            code = e.which;
            key = String.fromCharCode(code).toUpperCase();
            if (code === 173) {
                key = "-";// XXX: WTF
            }
            if (key === " ") {
                abnormal = false;
            }

            if (key === "1") {
                /* Exit view percentages mode */
                update_keyboard();
            }
        }
    });
}

// resolves when fully initialised
var initialised = new $.Deferred();

function initialise() {
    "use strict";

    init_objects();
    
    var init_fns = [function() {init_keyboard();}, function() {init_other();}];
    var init_array = [];
    var init_functions = [];

    var init_counter = counter.init();

    // for each member of init_fns
    // create a deferred object, set the init state to uninitialised

    class container {
        constructor(fun) {
            // Store a reference to our element
            // on the page
            this.fun = fun;
        }
        init() {
            // Create a new Deferred.
            var dfd = new $.Deferred();
            this.dfd = dfd;

            // Return an immutable promise object.
            // Clients can listen for its done or fail
            // callbacks but they can't resolve it themselves
            return dfd.promise();
        }
        run() {
            // run the function
            this.fun();

            this.dfd.resolve("Initialised");
        }
    }

    for (var i in init_fns) {
        var init_fn = init_fns[i];
        //init_fn();
        var cnt = new container(init_fn);
        //cnt.init();
        init_array.push(cnt.init());
        init_functions.push(cnt);
    }

    // join all the deferred functions
    $.when.apply($, init_array).done(function () {
        update_keyboard();
    } ).then(function () {
        open_keyboard();
        initialised.resolve();
    });


    $.when(init_counter).done(function() {
        /* Once cell_types has been populated successfully, load keyboard */
        load_keyboard();

        // resolve all deferred functions
        for (var i in init_functions) {
            var init_fn = init_functions[i];
            init_fn.run();
        }
    });

}

$(document).ready(initialise);

function resize_keyboard(width) {
    /* Does nothing */
}

function register_resets() {
    "use strict";
    $('.reset_button').on('click', function() {
        $("#confirm-reset").modal("show");
    });
    $('#reset-count').on('click', function() {
        var total = counter.get_total();
        log_stats(total);
        reset_counters();
        $("#confirm-reset").modal("hide");
    });
    $('#cancel-reset').on('click', function() {
        $("#confirm-reset").modal("hide");
    });
}

function reset_counters() {
    counter.reset();
    update_keyboard();
    chart.render();
}

function open_keyboard() {
    "use strict";
    $('#fuzz').fadeIn('slow', function () {
        resize_keyboard($("div#content").width());
        $('#counterbox').slideDown('slow', function () {
            $("#fuzz").css("height", $(document).height());
        });
    });
    keyboard_active = true;
    $('div#statistics').empty();
    $("#visualise2").css("display", "none");
    $("#savefilebutton").css("display", "none");
    chart.render();
}

function display_stats(count_total, format) {
    "use strict";
    var erythroid, i, j, cell_total, cell_percent, cell_percent_abnormal;
    var per="";
    var abnormal_total = 0;
    var stats_div = $('div#statistics');
    format = typeof format !== 'undefined' ? format: 'HTML';

    var count_data = counter.get_count_data();

    for (i=0; i < count_data.length; i++) {
        abnormal_total += count_data[i].abnormal;
    }

    for (i=0; i < count_data.length; i++) {
        cell_total = count_data[i].count + count_data[i].abnormal;
        cell_percent = Math.round(((cell_total / count_total) * 100));
        cell_percent_abnormal = 0;

        if (cell_total !== 0) {
            cell_percent_abnormal = Math.round(((count_data[i].abnormal / cell_total) * 100));
        }

        var cell_percent_string = '';
        var cell_percent_abnormal_string = '';

        if (count_data[i].abnormal === 0) {
            cell_percent_abnormal_string = 'N/A';
        } else if (cell_percent_abnormal === 0 && count_data[i].abnormal > 0) {
            cell_percent_abnormal_string = '<0.5%';
        } else {
            cell_percent_abnormal_string = cell_percent_abnormal.toString() + '%';
        }

        if (cell_percent === 0 && cell_total > 0) {
            cell_percent_string = '<0.5%';
        } else {
            cell_percent_string = cell_percent.toString() + '%';
        }

        if (cell_percent === 100 && cell_total < count_total) {
            cell_percent_string = '&ge;99.5%';
        }

        if (cell_percent_abnormal === 100 && count_data[i].abnormal < cell_total) {
            cell_percent_abnormal_string = '&ge;99.5%';
        }

        if (format === 'HTML') {
            per += '<tr><td class="celltypes">' + count_data[i].readable_name + '</td><td class="ignore" style="background-color:' + count_data[i].visualisation_colour + '"></td><td>' + cell_percent_string + "</td><td class=\"abnormal_stats\">" + cell_percent_abnormal_string + '</td><td>' + count_data[i].count + '</td><td class="abnormal_count abnormal_stats">' + count_data[i].abnormal + '</td></tr>';
        } else {
            per += count_data[i].readable_name + ' ' + cell_percent_string;
            if (abnormal_total > 0) {
                per += ', abnormal ' + cell_percent_abnormal_string + '\n';
            } else {
                per += '\n';
            }
        }
    }

    /* N.B. Hacky erythroid/myeloid counting */
    for (i=0; i < count_data.length; i++) {
        if (count_data[i].machine_name === 'erythroid') {
            erythroid = count_data[i].count + count_data[i].abnormal;
        }
    }

    var myeloid = 0;
    var myeloid_cells = ['neutrophils', 'meta', 'myelocytes', 'promyelocytes',
        'basophils', 'eosinophils', 'monocytes'];

    for (i=0; i < myeloid_cells.length; i++) {
        for (j=0; j < count_data.length; j++) {
            if (count_data[j].machine_name === myeloid_cells[i]) {
                myeloid += (count_data[j].count + count_data[j].abnormal);
            }
        }
    }

    var me_ratio = parseFloat(myeloid / erythroid).toFixed(2);
    if (me_ratio === 'Infinity') {
        me_ratio = 'Incalculable';
    }
    stats_div.empty().append('<div id="output_style">Format output: <button id="htmlview" class="btn">HTML</button><button id="textview" class="btn">Text</button></div>');
    $('#htmlview').click(function() {
        display_stats(count_total, 'HTML');
    });
    $('#textview').click(function() {
        display_stats(count_total, 'TEXT');
    });

    var stats_text = '';

    if (format === 'HTML') {
        stats_text = '<h3>Count statistics</h3><table class="table table-bordered table-striped">';
        stats_text += '<tr><td colspan="2" class="celltypes">Cells Counted</td><td>' + count_total + '</td><td class="table_spacer" colspan="3"></td></tr>';
        stats_text += '<tr><td colspan="2" class="celltypes">ME ratio *</td><td>' + me_ratio + '</td><td class="table_spacer" colspan="3"></td></tr>';
        stats_text += '<tr><th colspan="2" style="width: 30%"></th><th>% Total</th><th class="abnormal_stats">% of CellType Abnormal</th><th>Normal</th><th class="abnormal_stats">Abnormal</th></tr>';
        stats_text += per;
        stats_text += '</table>';
        stats_text += '<p>* Note: Myeloid/erythroid ratio does not include blast count.</p>';
        stats_div.append(stats_text);
        $("#visualise2").css("display", "block");
    } else {
        stats_text = '<pre class="stats"><code>';
        stats_text += 'Cells Counted: ' + count_total + '\n';
        stats_text += 'M:E Ratio: ' + me_ratio + '\n';
        stats_text += per;
        stats_text += '</code></pre>';
        stats_div.append(stats_text);
    }

    if (abnormal_total === 0 && format === 'HTML') {
        /* If we don't have abnormal cells, don't show the columns */
        $('.abnormal_stats').hide();
        $('.table_spacer').attr('colspan', 1);
    }

    chart2.render();
}

function log_stats(total) {
    "use strict";
    if (total > 75) {
        $.ajax({
            url: '/api/stats/',
            type: 'POST',
            data: JSON.stringify({"count_total": total}),
            contentType: "application/json; charset=utf-8",
            async: true
        });
    }
}

function set_keyboard(mapping) {
    "use strict";
    keyboard_map = mapping;
    update_keyboard();
    chart.render();
}

function load_keyboard(keyboard_id) {
    "use strict";
    if (keyboard_id === undefined) {
        $.getJSON("/api/keyboards/default/", function(data) {
            keyboard_map = data;
            update_keyboard();
            chart.render();
        });
    } else {
        var keyboard = {};
        $.ajax({
            url: '/api/keyboards/' + keyboard_id + '/',
            type: 'GET',
            dataType: 'json',
            contentType: "application/json; charset=utf-8",
            async: false,
            success: function(data) {
                keyboard = data;
            }
        });
        return keyboard;
    }
}

function set_keyboard_primary(keyboard_id) {
    "use strict";
    var keyboard = load_keyboard(keyboard_id);
    keyboard.is_primary = true;
    save_keyboard(keyboard);
    return false;
}

function delete_specific_keyboard(keyboard_id) {
    "use strict";
    var keyboard = load_keyboard(keyboard_id);
    $.ajax({
        url: '/api/keyboards/' + keyboard.id + '/',
        type: 'DELETE',
        data: JSON.stringify(keyboard),
        contentType: "application/json; charset=utf-8",
        async: false
    });
}


function update_key_display(cell_id) {
    var counts = counter.get_counts(cell_id);
    for (k = 0; k< cell_types[cell_id].box.length; k++) {
        $(cell_types[cell_id].box[k]).find("span.abnormal").text("("+counts.abnormal+")");
    }
    for (k = 0; k < cell_types[cell_id].box.length; k++) {
        $(cell_types[cell_id].box[k]).find("span.countval").text(counts.normal);
    }
}

function update_keyboard() {
    "use strict";
    var i, j, k;
    var keyboard_keys = $("#keysbox").find("div.box1");

    for (var cell in cell_types) {
        if (cell_types.hasOwnProperty(cell)) {
            cell_types[cell].box = [];
        }
    }

    for (i = 0; i < keyboard_keys.length; i++) {
        var item = $(keyboard_keys[i]);
        var key = item.attr("id");

        item.empty();
        item.append("<p>"+key+"</p>");

        for (j = 0; j < keyboard_map.mappings.length; j++) {

            if (keyboard_map.mappings[j].key === key) {
                var cell_id = keyboard_map.mappings[j].cellid;
                var cell_data = cell_types[cell_id];

                /* Adds keyboard key div to list of attached keys */
                cell_data.box.push(item);
                var name = cell_data.abbr_name;
                
                var counts = counter.get_counts(cell_id);
                item.append("<div class=\"name\">"+name+"</div>");
                item.append("<div class=\"count\"><span class=\"countval\">"+counts.normal+"</span> <span class=\"abnormal abnormal_count\">("+counts.abnormal+")</span></div>");

                // Attach cell visualisation_colour to key
                item.find("p").css("background-color", cell_data.visualisation_colour);
            }
        }
    }
}

function edit_keyboard() {
    "use strict";

    if (editing_keyboard) {
        return;
    }
    var cell;
    var list = "<ul>";

    for (cell in cell_types) {
        if (cell_types.hasOwnProperty(cell)) {
            list += "<li><div class=\"element\"><div class=\"edit_colour_swatch\" id=\"swatch_"+cell+"\"></div>"+cell_types[cell].readable_name+"</div><div class=\"cellid\" style=\"display: none;\">"+cell+"</div></li>";
        }
    }
    list += "</ul>";
    
    var cell_list_div = $("div#celllist");

    cell_list_div.empty();
    cell_list_div.append(list);

    for (cell in cell_types) {
        if (cell_types.hasOwnProperty(cell)) {
            $("div#swatch_"+cell).css("background-color", cell_types[cell].visualisation_colour);
        }
    }

    cell_list_div.find("div.element").click(function() {
        edit_cell_id = $(this).find("div.cellid").text();
        $("div#celllist").find("li").css("background", "");
        deselect_element(selected_element);
        selected_element = $(this).parent();
        select_element($(this).parent());
    });

    var el = cell_list_div.find("li").first();
    select_element(el);

    $("#clearkeyboard").click(function() {
        clear_keyboard();
    });

    editing_keyboard = true;

    var save_text = "Save";
    var save_keys = true;
    if(typeof notloggedin !== 'undefined') {
        save_text = "Close";
        save_keys = false;
    }

    var d = $("div#editkeymapbox").dialog({
        close: function() {
            end_keyboard_edit();
        },
        open: function() {
            //remove focus from the default button
            $('.ui-dialog :button').blur();
        },
        resizable: false,
        buttons: [ {text: save_text,
                    click: function() {
                        if (save_keys) {
                            save_keyboard();
                        } else {
                            end_keyboard_edit();
                        }
                    }
                    },
                    {text: 'Save as New',
                     click: function() {
                         if (save_keys) {
                             keyboard_name_input();
                         } else {
                             end_keyboard_edit();
                         }
                     }
                    },
                    {text: "Revert",
                     click: function() {
                         load_keyboard();
                         $("div#editkeymapbox").dialog("close");
                     }
                    }
                ],
        width: "368px"
    });

    $(d).dialog('widget')
        .position({ my: 'right top', at: 'right top', of: $("div#counterbox") });

    if (!save_keys) {
        $(":button:contains('Save as New')").remove();
    }
}

function select_element(el) {
    "use strict";

    selected_element = $(el);

    if(!selected_element.html()) {
        selected_element = $("div#celllist").find("li").first();
        el = selected_element;
        selected_element = $(selected_element);
    }

    if(selected_element.html()) {
        edit_cell_id = $(el).find("div.cellid").text();
        $(el).addClass("selected");
    }
    else {
        edit_cell_id = -1;
    }
}

function deselect_element(el) {
    "use strict";

    $(el).removeClass("selected");
}

function keyboard_name_input() {
    "use strict";
    // Disable keyboard capture for edit/input
    editing_keyboard = false;
    keyboard_active = false;
    // Show us the keyboard modal
    $("#keyboard_name").modal("show");
}

function save_new_keyboard(keyboard_name) {
    "use strict";
    // Takes keyboard_name from dialog and creates keyboard
    // Scraps any pre-existing keyboard_id
    delete(keyboard_map.id);
    keyboard_name = keyboard_name || 'NewKeyboard';
    keyboard_map.label = keyboard_name;
    save_keyboard();

    $("#keyboard_name").modal("hide");
    // This is required to override default modal hide behaviour (above)
    // as when a keyboard is successfully saved, user should return to
    // count.
    editing_keyboard = false;
}

function save_keyboard(keyboard) {
    "use strict";

    if (typeof keyboard === 'undefined') {
        keyboard = keyboard_map;
    }

    if ("id" in keyboard) {
        $.ajax({
            url: '/api/keyboards/' + keyboard.id + '/',
            type: 'PUT',
            data: JSON.stringify(keyboard),
            contentType: "application/json; charset=utf-8",
            async: false,
            success: function() {
                add_alert('INFO', 'Keyboard saved');
                end_keyboard_edit();
            }
        });
    } else {
        $.ajax({
            url: '/api/keyboards/',
            type: 'POST',
            data: JSON.stringify(keyboard),
            contentType: "application/json; charset=utf-8",
            async: false,
            success: function() {
                add_alert('INFO', 'Keyboard saved');
                end_keyboard_edit();
            }
        });
    }
}

function end_keyboard_edit() {
    "use strict";

    $("div#celllist").empty();

    editing_keyboard = false;
    edit_cell_id = -1;
    $("#edit_button").show();
    $("div#editkeymapbox").dialog("close");
}

function clear_keyboard() {
    "use strict";
    /* Clear keyboard needs to provide the correct keyboard_map structure
     * otherwise modification of a blank keyboard fails. Also maintain
     * object ID when clearing keyboards so we save to the right place.
      * N.B. .toISOString() requires a shim for IE<= 8 */
    if ('id' in keyboard_map) {
        var id = keyboard_map.id;
    }
    if ('user' in keyboard_map) {
        var user = keyboard_map.user;
    }
    var date = new Date(Date.now()).toISOString();
    keyboard_map = {"label": "Default", "is_primary": true, "created": date,
                    "last_modified": date, "mappings": []};
    if (typeof id !== 'undefined') {
        keyboard_map.id = id;
    }
    if (typeof user !== 'undefined') {
        keyboard_map.user = user;
    }
    update_keyboard();
}

function add_alert(alert_class, message) {
    "use strict";
    /* Adds alert messages in bootstrap style to page */
    var css_class = "";
    if (alert_class === 'ERROR') {
        css_class = 'alert-error';
    }
    var el = "<div class=\"alert " + css_class + "\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\">×</button><strong>" + alert_class + ":</strong> " + message + "</div>";
    $('#alerts').append(el);
}

function csrfSafeMethod(method) {
    "use strict";
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

function sameOrigin(url) {
    "use strict";
    // test that a given url is a same-origin URL
    // url could be relative or scheme relative or absolute
    var host = document.location.host; // host + port
    var protocol = document.location.protocol;
    var sr_origin = '//' + host;
    var origin = protocol + sr_origin;
    // Allow absolute or scheme relative URLs to same origin
    return (url == origin || url.slice(0, origin.length + 1) == origin + '/') ||
        (url == sr_origin || url.slice(0, sr_origin.length + 1) == sr_origin + '/') ||
        // or any other URL that isn't scheme relative or absolute i.e relative.
        !(/^(\/\/|http:|https:).*/.test(url));
}

$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        "use strict";
        var csrftoken = $.cookie('csrftoken');
        if (!csrfSafeMethod(settings.type) && sameOrigin(settings.url)) {
            // Send the token to same-origin, relative URLs only.
            // Send the token only if the method warrants CSRF protection
            // Using the CSRFToken value acquired earlier
            xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
    }
});
