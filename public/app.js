console.log("INI JALAN APP.JS WOI")

// ISBN search function
document.getElementById('search-isbn-button').addEventListener('click', async function() {
    const isbn_input = document.getElementById('isbn_input').value;
    console.log(isbn_input);
    try {
        const response = await fetch(`/get-image-data/${isbn_input}`);
        if (response.ok) {
            const image_data = await response.json();
            if (image_data && image_data.content_type) {
                console.log('Book found');
                document.getElementById('isbn-validation').innerHTML = '&#10003;';
                document.getElementById('isbn_input').classList.remove('invalid');
                document.getElementById('isbn_input').classList.add('valid');
            } else {
                console.log('Book not found');
                document.getElementById('isbn-validation').innerHTML = '&#10005;';
                document.getElementById('isbn_input').classList.remove('valid');
                document.getElementById('isbn_input').classList.add('invalid');
            }
        } else {
            console.error('Error fetching image data:', response.statusText);
        }
    } catch(error) {
        console.error('Error:', error);
    }
});

// function to check form validity before submitting
document.getElementById('new-book-form').addEventListener('submit', function(event) {
    const isbn_input = document.getElementById('isbn_input');
    if(isbn_input.classList.contains('valid')) {
        return true;
    } else {
        event.preventDefault();
        alert('ISBN input is invalid. Please enter a valid ISBN.');
        return false;
    }


})

// initializing const which selects needed elements
const add_new_overlay = document.querySelector('.add-new-overlay');
const add_new_container = document.querySelector('.add-new-container');
const add_new_btn = document.querySelector('.add-new-btn');
const close_add_btn = document.querySelector('.close-btn');
const navbar = document.querySelector(".navbar");

// Function to show the add new book overlay and container
add_new_btn.addEventListener('click', function(event) {
    event.stopPropagation();
    user_option.classList.add('hidden');
    filter_content_container.classList.add('hidden'); 
    add_new_overlay.classList.remove('hidden');
    add_new_container.classList.remove('hidden');
    navbar.classList.add("turn-off-sticky");
});

// Function to hide the add new book overlay and container
document.addEventListener('click', function(event) {
    if (event.target === close_add_btn || !add_new_container.contains(event.target)) {
        add_new_overlay.classList.add('hidden');
        add_new_container.classList.add('hidden');
        navbar.classList.remove("turn-off-sticky");
    }
});

/*
function to show filter options when the filter button is clicked 
and hides it when user clicks elsewhere other than the filter content container
*/
const filter_btn = document.getElementById('filter-btn');
const filter_content_container = document.querySelector('.filter-content-container');

document.addEventListener('click', function(event) {
    if(event.target === filter_btn ) {
        filter_content_container.classList.toggle('hidden');
    } else if (!filter_content_container.contains(event.target)) {
        filter_content_container.classList.add('hidden');
    }
});

// function that redirects user to a particular endpoint and query when user clicks the filter links
const filterLinks = document.querySelectorAll('.filter-links-container a');
filterLinks.forEach(function (link) {
    link.addEventListener('click', function(event) {
        event.preventDefault(); // prevents the default behavior of the anchor element to redirect
        const filterType = this.id; // fetching the filterType from currrent element's id
        const filterUrl = `/?filterType=${filterType}`; // Construct URL with filterType parameter
        window.location.href = filterUrl; // redirects user to the filterUrl link
    });
});

// Function to handle search input from user
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('search-bar').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default form submission behavior
            const searchQuery = this.value.trim();
            if (searchQuery) {
                window.location.href = `/search?query=${encodeURIComponent(searchQuery)}`; // encodeURIComponent is to prepare the search query for inclusion in URI or URL query params
            }
        }
    });
});

// function which brings you to the previous page without reloading
function goBack() {
    window.history.back();
}


