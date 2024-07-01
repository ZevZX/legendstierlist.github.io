const MAX_NAME_LEN = 200;
const DEFAULT_TIERS = ['Godly','Z+','Z','S','A','B','C','D','E','F'];
const TIER_COLORS = [
	// from Godly to F
	'#59dffa',
	'#f979ad',
	'#f8d423',
	'#d85cfb',
	'#7dc6f6',
	'#70d46c',
	'#c6d0b3',
	'#b4b49e',
	'#a5b3a3',
	'#788080'
];

let unique_id = 0;

let unsaved_changes = false;

let currentDroppable = null;

// Contains [[header, input, label]]
let all_headers = [];
let headers_orig_min_width;

// DOM elems
let untiered_images;
let tierlist_div;
let dragged_image;

let draggedItem = null;
let placeholder = null;

window.addEventListener('load', () => {
	loadImagesFromJson();
	
	untiered_images =  document.querySelector('.images');
	tierlist_div =  document.querySelector('.tierlist');

	for (let i = 0; i < DEFAULT_TIERS.length; ++i) {
		add_row(i, DEFAULT_TIERS[i]);
	}
	recompute_header_colors();

	headers_orig_min_width = all_headers[0][0].clientWidth;

	make_accept_drop(document.querySelector('.images'));

	document.getElementById('load-img-input').addEventListener('input', (evt) => {
		// @Speed: maybe we can do some async stuff to optimize this
		let images = document.querySelector('.images');
		for (let file of evt.target.files) {
			let reader = new FileReader();
			reader.addEventListener('load', (load_evt) => {
				let img = create_img_with_src(load_evt.target.result);
				images.appendChild(img);
				unsaved_changes = true;
			});
			reader.readAsDataURL(file);
		}
	});

	document.getElementById('reset-list-input').addEventListener('click', () => {
		if (confirm('Reset Tierlist? (this will place all images back in the pool)')) {
			soft_reset_list();
		}
	});

	document.getElementById('export-input').addEventListener('click', () => {
		let name = prompt('Please give a name to this tierlist');
		if (name) {
			save_tierlist(`${name}.json`);
		}
	});

	document.getElementById('import-input').addEventListener('input', (evt) => {
		if (!evt.target.files) {
			return;
		}
		let file = evt.target.files[0];
		let reader = new FileReader();
		reader.addEventListener('load', (load_evt) => {
			let raw = load_evt.target.result;
			let parsed = JSON.parse(raw);
			if (!parsed) {
				alert("Failed to parse data");
				return;
			}
			hard_reset_list();
			load_tierlist(parsed);
		});
		reader.readAsText(file);
	});

	window.addEventListener('beforeunload', (evt) => {
		if (!unsaved_changes) return null;
		var msg = "You have unsaved changes. Leave anyway?";
		(evt || window.event).returnValue = msg;
		return msg;
	});
});

function create_img_with_src(src) {
    let container = document.createElement('div');
    container.style.width = '50px';
    container.style.height = '50px';
    container.style.backgroundImage = `url('${src}')`;
    container.style.backgroundSize = 'cover';
    container.style.backgroundPosition = 'center';
    container.classList.add('draggable', 'resizable-image');
    container.draggable = true;

    let item = document.createElement('span');
    item.classList.add('item');
    item.appendChild(container);

    return item;
}

function end_drag(evt) {
	dragged_image?.classList.remove("dragged");
	dragged_image = null;
}

window.addEventListener('mouseup', end_drag);
window.addEventListener('dragend', end_drag);

function enable_edit_on_click(container, input, label) {
	function change_label(evt) {
		input.style.display = 'none';
		label.innerText = input.value;
		label.style.display = 'inline';
		unsaved_changes = true;
	}

	input.addEventListener('change', change_label);
	input.addEventListener('focusout', change_label);

	container.addEventListener('click', (evt) => {
		label.style.display = 'none';
		input.value = label.innerText.substr(0, MAX_NAME_LEN);
		input.style.display = 'inline';
		input.select();
	});
}

function create_label_input(row, row_idx, row_name) {
	let input = document.createElement('input');
	input.id = `input-tier-${unique_id++}`;
	input.type = 'text';
	input.addEventListener('change', resize_headers);
	let label = document.createElement('label');
	label.htmlFor = input.id;
	label.innerText = row_name;

	let header = row.querySelector('.header');
	all_headers.splice(row_idx, 0, [header, input, label]);
	header.appendChild(label);
	header.appendChild(input);

	enable_edit_on_click(header, input, label);
}

function resize_headers() {
	let max_width = headers_orig_min_width;
	for (let [other_header, _i, label] of all_headers) {
		max_width = Math.max(max_width, label.clientWidth);
	}

	for (let [other_header, _i2, _l2] of all_headers) {
		other_header.style.minWidth = `${max_width}px`;
	}
}

function add_row(index, name) {
	let div = document.createElement('div');
	let header = document.createElement('span');
	let items = document.createElement('span');
	div.classList.add('row');
	header.classList.add('header');
	items.classList.add('items');
	div.appendChild(header);
	div.appendChild(items);
	let row_buttons = document.createElement('div');
	row_buttons.classList.add('row-buttons');
	let btn_plus_up = document.createElement('input');
	btn_plus_up.type = "button";
	btn_plus_up.value = '˄';
	btn_plus_up.title = "Add row above";
	btn_plus_up.addEventListener('click', (evt) => {
		let parent_div = evt.target.parentNode.parentNode;
		let rows = Array.from(tierlist_div.children);
		let idx = rows.indexOf(parent_div);
		console.assert(idx >= 0);
		let newRow = add_row(idx, 'NEW');
		newRow.querySelector('.header').style.backgroundColor = '#fc3f32';
		// recompute_header_colors();
	});
	let btn_rm = document.createElement('input');
	btn_rm.type = "button";
	btn_rm.value = '-';
	btn_rm.title = "Remove row";
	btn_rm.addEventListener('click', (evt) => {
		let rows = Array.from(tierlist_div.querySelectorAll('.row'));
		if (rows.length < 2) return;
		let parent_div = evt.target.parentNode.parentNode;
		let idx = rows.indexOf(parent_div);
		console.assert(idx >= 0);
		if (rows[idx].querySelectorAll('img').length === 0 ||
			confirm(`Remove tier ${rows[idx].querySelector('.header label').innerText}? (This will move back all its content to the untiered pool)`))
		{
			rm_row(idx);
		}
		recompute_header_colors();
	});
	let btn_plus_down = document.createElement('input');
	btn_plus_down.type = "button";
	btn_plus_down.value = '˅';
	btn_plus_down.title = "Add row below";
	btn_plus_down.addEventListener('click', (evt) => {
		let parent_div = evt.target.parentNode.parentNode;
		let rows = Array.from(tierlist_div.children);
		let idx = rows.indexOf(parent_div);
		console.assert(idx >= 0);
		let newRow = add_row(idx + 1, 'NEW');
		newRow.querySelector('.header').style.backgroundColor = '#fc3f32';
	});
	row_buttons.appendChild(btn_plus_up);
	row_buttons.appendChild(btn_rm);
	row_buttons.appendChild(btn_plus_down);
	div.appendChild(row_buttons);

	let rows = tierlist_div.children;
	if (index === rows.length) {
		tierlist_div.appendChild(div);
	} else {
		let nxt_child = rows[index];
		tierlist_div.insertBefore(div, nxt_child);
	}

	make_accept_drop(div);
	create_label_input(div, index, name);

	return div;
}

function rm_row(idx) {
	let row = tierlist_div.children[idx];
	reset_row(row);
	tierlist_div.removeChild(row);
}

function reset_row(row) {
	row.querySelectorAll('span.item').forEach((item) => {
		for (let i = 0; i < item.children.length; ++i) {
			let img = item.children[i];
			item.removeChild(img);
			untiered_images.appendChild(img);
		}
		item.parentNode.removeChild(item);
	});
}

function recompute_header_colors() {
	tierlist_div.querySelectorAll('.row').forEach((row, row_idx) => {
		let color = TIER_COLORS[row_idx % TIER_COLORS.length];
		row.querySelector('.header').style.backgroundColor = color;
	});
}

// Call this function after loading images
function loadImagesFromJson() {
    fetch('images.json')
        .then(response => response.json())
        .then(data => {
            const imagesContainer = document.querySelector('.images');
            data.images.forEach(imageData => {
                const img = create_img_with_src(imageData.path);
                img.dataset.rarity = imageData.rarity;
                img.dataset.cardNumber = imageData.cardNumber;
                imagesContainer.appendChild(img);
            });
            console.log(`Loaded ${data.images.length} images`);
        })
        .catch(error => console.error('Error loading images:', error));
}

function createPlaceholder() {
    const ph = document.createElement('div');
    ph.classList.add('placeholder');
    ph.style.width = `${draggedItem.offsetWidth}px`;
    ph.style.height = `${draggedItem.offsetHeight}px`;
    return ph;
}

function updateDragPosition(e, container) {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const items = Array.from(container.querySelectorAll('.item:not(.dragged)'));
    let insertBefore = null;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemRect = item.getBoundingClientRect();
        const itemX = itemRect.left - rect.left;
        const itemY = itemRect.top - rect.top;
        
        if (y < itemY + itemRect.height / 2) {
            if (x < itemX + itemRect.width / 2) {
                insertBefore = item;
                break;
            }
        } else if (i === items.length - 1) {
            insertBefore = item.nextSibling;
            break;
        }
    }

    if (insertBefore !== placeholder.nextSibling) {
        container.insertBefore(placeholder, insertBefore);
    }
}

function make_accept_drop(elem) {
    elem.classList.add('droppable');

    elem.addEventListener('dragenter', (evt) => {
        evt.preventDefault();
        evt.target.classList.add('drag-entered');
        if (draggedItem && !placeholder) {
            placeholder = createPlaceholder();
        }
    });

    elem.addEventListener('dragleave', (evt) => {
        evt.preventDefault();
        evt.target.classList.remove('drag-entered');
        if (placeholder && !elem.contains(evt.relatedTarget)) {
            placeholder.remove();
            placeholder = null;
        }
    });

    elem.addEventListener('dragover', (evt) => {
        evt.preventDefault();
        if (draggedItem) {
            updateDragPosition(evt, elem.querySelector('.items') || elem);
        }
    });

	elem.addEventListener('drop', (evt) => {
        evt.preventDefault();
        evt.target.classList.remove('drag-entered');

        if (!draggedItem) return;

        let itemsContainer = elem.querySelector('.items') || elem;

        if (placeholder) {
            itemsContainer.insertBefore(draggedItem, placeholder);
            placeholder.remove();
            placeholder = null;
        } else {
            itemsContainer.appendChild(draggedItem);
        }

        draggedItem.classList.remove('dragged');
        draggedItem.style.position = '';
        draggedItem.style.zIndex = '';
        draggedItem.style.left = '';
        draggedItem.style.top = '';
        draggedItem = null;
        unsaved_changes = true;
    });
}

// Add new mousedown event listener for drag initiation
document.addEventListener('mousedown', (evt) => {
    if (evt.target.classList.contains('draggable') || evt.target.closest('.draggable')) {
        draggedItem = evt.target.closest('.item') || evt.target;
        draggedItem.classList.add('dragged');
        
        // Create and add placeholder
        placeholder = createPlaceholder();
        draggedItem.parentNode.insertBefore(placeholder, draggedItem.nextSibling);
        
        // Set initial position of dragged item
        draggedItem.style.position = 'absolute';
        draggedItem.style.zIndex = '1000';
        moveAt(evt.pageX, evt.pageY);
        
        // Move dragged element on mousemove
        function onMouseMove(e) {
			moveAt(e.pageX, e.pageY);
			draggedItem.hidden = true;
			let elemBelow = document.elementFromPoint(e.clientX, e.clientY);
			draggedItem.hidden = false;
			
			let droppableBelow = elemBelow?.closest('.droppable');
			if (droppableBelow) {
				let itemsContainer = droppableBelow.querySelector('.items') || droppableBelow;
				if (itemsContainer !== currentDroppable) {
					if (currentDroppable) {
						leaveDroppable(currentDroppable);
					}
					currentDroppable = itemsContainer;
					enterDroppable(currentDroppable);
				}
			} else if (currentDroppable) {
				leaveDroppable(currentDroppable);
				currentDroppable = null;
			}
		}
		
		function enterDroppable(elem) {
			elem.classList.add('drag-entered');
		}
		
		function leaveDroppable(elem) {
			elem.classList.remove('drag-entered');
		}

        // Move the dragged element to the cursor position
        function moveAt(pageX, pageY) {
            draggedItem.style.left = pageX - draggedItem.offsetWidth / 2 + 'px';
            draggedItem.style.top = pageY - draggedItem.offsetHeight / 2 + 'px';
        }

        document.addEventListener('mousemove', onMouseMove);

        // Remove listeners on mouseup
        draggedItem.onmouseup = function() {
            document.removeEventListener('mousemove', onMouseMove);
            draggedItem.onmouseup = null;
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.insertBefore(draggedItem, placeholder);
                placeholder.remove();
            }
            draggedItem.classList.remove('dragged');
            draggedItem.style.position = '';
            draggedItem.style.zIndex = '';
            draggedItem.style.left = '';
            draggedItem.style.top = '';
            draggedItem = null;
            placeholder = null;
            unsaved_changes = true;
        };
    }
});