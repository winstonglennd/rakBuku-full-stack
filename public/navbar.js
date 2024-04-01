// function to show users when user profile is clicked, and hides it when user clicks elsewhere other than the user options class el
const user_profile = document.querySelector('.user-profile');
const user_option = document.querySelector('.user-options');

user_profile.addEventListener('click', function() {    
    user_option.classList.toggle('hidden');
})

document.addEventListener('click', function(event) {
    if(!user_profile.contains(event.target) && !user_option.contains(event.target)) {
        user_option.classList.add('hidden');
    }
})

// function to open the hamburger menu
const hamburger_btn = document.querySelector('.hamburger');
const search_and_profile = document.querySelector('.search-and-profile');

hamburger_btn.addEventListener('click', function() {
    search_and_profile.classList.toggle('active');
    hamburger_btn.classList.toggle('active');
})

