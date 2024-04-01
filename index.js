import express from 'express';
import pg from 'pg';
import axios from 'axios';
import bodyParser from "body-parser";

// initializing express, port, and api domain as a variable
const app = express();
const port = 3000;
const apiDom = 'https://covers.openlibrary.org/b/isbn/';

// initializing db, change the data according to yours
const db = new pg.Client({
    user: 'postgres',
    host: 'localhost',
    database: 'RakBuku',
    password: 'wgd2680',
    port: '5432'
});

// connecting to database
db.connect();

// initialilzing bodyParser middlewear and set program to look into the /public file path for static files (style, images, etc)
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'));

// initialize the first user / account
let currentUser = 1;

// A function to retrieve JSON image data from the api, and convert it from arrayBuffer into string
async function get_image_data(isbn) {
    try {
        let result = await axios.get(apiDom + isbn + "-L.jpg", {
            responseType: 'arraybuffer'
        });
        
        const content_type = result.headers['content-type'];
        const image_data = Buffer.from(result.data).toString('base64');

        const image_data_object = {
            content_type: content_type,
            image_data: image_data,
        };

        return image_data_object;
    } catch (error) {
        // Handle the error here
        console.error('Error fetching image data:', error);
        throw new Error('Failed to fetch image data');
        // Alternatively, you can return a default value or handle the error in a different way
    }
}

/* A function to get user reads by user id, and in case the user chooses to filter the books by a certain filter type it will show the
books which meets the crieteria of the filter type from database
*/
async function get_user_reads(currentUser, filterType) {
    let reads = [];
    let query = 'SELECT * FROM readinglists rl JOIN books b on rl.book_id = b.book_id WHERE user_id = $1';
    let queryParams = [currentUser];

    if(filterType) { // if user chooses to filter the reading list, then this if and switch statement will be executed, else it will skip this part
        switch(filterType) {
            case 'filter-title':
                query += ' ORDER BY b.book_title';
                break;
            case 'filter-latest':
                query += ' ORDER BY rl.list_id DESC';
                break;
            case 'filter-genre':
                query += ' ORDER BY b.book_genre';
                break;
            case 'filter-rating':
                query += ' ORDER BY rl.book_rating DESC';
                break;
            default:
                break;
        }
    }

    try {
        let result = await db.query(query, queryParams); // querying the db then fetching the reading list data
        
        for (const row of result.rows) { // using for of loop will respect the async await before proceeding to the next iteration
            let image_data_object = await get_image_data(row.book_isbn);
            let date = row.date_read.getDate() + '-' + (row.date_read.getMonth() + 1) + '-' + row.date_read.getFullYear();
            let reads_data = {
                book_id: row.book_id,
                content_type: image_data_object.content_type,
                image_data: image_data_object.image_data,
                title: row.book_title,
                author: row.book_author,
                date_read: date,
                rating: row.book_rating,
                genre: row.book_genre,
                isbn: row.book_isbn,
            }
            reads.push(reads_data);
        }
        return reads;
    } catch (error) {
        console.error('Error fetching user reads:', error);
        throw new Error('Failed to fetch user reads');
    }
}

// A function to get users and its informations form the database
async function get_users(){
    try {
        const response = await db.query('SELECT * FROM users');
        let users = [];
        for(const row of response.rows) {
            let user_id = row.user_id;
            let user_name = row.user_name;

            let user_data = {
                user_id: user_id,
                user_name: user_name,
            }
            users.push(user_data);
        }
        return users;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw new Error('Failed to fetch users');
    }
}

// A function to add new user into the database
async function insertName(name) {
    try {
      await db.query('INSERT INTO users (user_name) VALUES($1)', [name]);  
    } catch(error) {
        console.log("error inserting name");
        throw new Error('Failed inserting user name');
    }
    
}

// A function to delete a user and all of its related data from the database, including user reads and book summaries
async function deleteUserAndData(user_id) {
    try {
        await db.query('DELETE FROM readinglists WHERE user_id = $1', [user_id]);
        await db.query('DELETE FROM summaries WHERE user_id = $1', [user_id]);
        await db.query('DELETE FROM users WHERE user_id = $1', [user_id]);
        currentUser = await getNextAvailableUser();
        console.log("SUCCESSFULLY DELETE USER AND DATA of user:", user_id);
    } catch(error) {
        console.log('error deleting user');
        throw new Error("Failed to delete user and associated data");
    }
}

// A function to retrieve user summary by user id and book id from the database
async function getSummary(user_id, book_id) {
    try {
        let summary = await db.query('SELECT summary_text FROM summaries WHERE user_id = $1 AND book_id = $2', [user_id, book_id]);
        if(summary.rows.length === 0) {
            return null
        }
        return summary.rows[0];
    } catch(error) {
        console.log('error fetching summary');
        throw new Error("Failed to fetch summary");
    }
}

// A function to get book data and information
async function getBookData(book_id) {
    try {
        const book_data = await db.query('SELECT * FROM books WHERE book_id = $1', [book_id]);
        
        if(book_data.rows.length === 0) {
            throw new Error('Book not found');
        }

        return book_data.rows[0];
    } catch(error) {
        console.log('Error fetching book data:', error);
        throw new Error('Failed to fetch book data');
    }
}

// A function to get informations about current user and send it to the front end
function getCurrentUserObject(users) {
    const currentUserObject = users.find(user => user.user_id == currentUser);
    return currentUserObject;
}

// A function to get the last user after finish deleting a user, so 
async function getNextAvailableUser() {
    try {
        const result = await db.query('SELECT user_id FROM users ORDER BY user_id DESC LIMIT 1');
        if (result && result.rows.length > 0) {
            return result.rows[0].user_id;
        }
        // If no users are available, return null
        return null;
    } catch (error) {
        console.error('Error fetching next available user:', error);
        return null;
    }
}

// A function to insert book to all related tables in the database
async function insert_book_to_all_table(newBook, book_summary) {
    try {
        let listAvail = false;
        let book_id = 1;
        const book_isbn = newBook.book_isbn;
        const check_avail_book = await db.query('SELECT * FROM books WHERE book_isbn = $1', [book_isbn]); // try to find the newly insereted book in database
        if(check_avail_book.rows.length  === 0) { // if the newly inserted book isn't available yet in the books table, then insert
            const insertedBook = await db.query('INSERT INTO books (book_title, book_author, book_isbn, \
            publish_year, book_genre) VALUES($1, $2, $3, $4, $5) RETURNING book_id', [newBook.book_title, newBook.book_author, 
            book_isbn, newBook.publish_year, newBook.book_genre]);
            book_id = insertedBook.rows[0].book_id;
        } else { // else take the book id 
            book_id = check_avail_book.rows[0].book_id;
        }
        // Checking if the newly inserted reading list is available yet in the reading lists table
        const check_avail_list = await db.query('SELECT * FROM readinglists WHERE user_id = $1 AND book_id = $2', [currentUser, book_id]);
        if(check_avail_list.rows.length > 0) { // if it's available, then return the function with listAvail is true, else skip this line
            listAvail = true;
            return listAvail;
        }

        /* The reason it returns a boolean is for upcoming updates. Therefore, when the newly inserted reading list is already available,
            dev can create the logic using that boolean value and later notify user about the error
        */

        // inserting new reading list into reading list table
        try {
            await db.query('INSERT INTO readinglists (date_read, user_id, book_id, book_rating)\
            VALUES(CURRENT_DATE, $1, $2, $3)', [currentUser, book_id, newBook.book_rating]); 
        } catch(error) {
            console.log('Error inserting into reading lists', error);
            throw new Error('Failed insertng into reading lists');
        }

        // inserting summary_text into summary table
        try {
            await db.query('INSERT INTO summaries (user_id, book_id, summary_text) \
            VALUES($1, $2, $3)', [currentUser, book_id, book_summary]);
        } catch(error) {
            console.log('Error inserting data into summaries');
            throw new Error('Failed inserting into summaries');
        }

        return listAvail;

    } catch(error) {
        console.log('Error inserting new book');
        throw new Error('Failed inserting new book');
    }
}

// A function to return searched books
async function searchResult(sanitizedQuery) {
    try {
        let reads = [];
        const result = await db.query('SELECT * FROM readinglists rl JOIN books b on rl.book_id = b.book_id WHERE user_id = $1\
        AND (LOWER(b.book_title) LIKE $2 OR LOWER(b.book_author) LIKE $2)', [currentUser, sanitizedQuery]);

        for (const row of result.rows) {
            let image_data_object = await get_image_data(row.book_isbn);
            let date = row.date_read.getDate() + '-' + (row.date_read.getMonth() + 1) + '-' + row.date_read.getFullYear();
            let reads_data = {
                book_id: row.book_id,
                content_type: image_data_object.content_type,
                image_data: image_data_object.image_data,
                title: row.book_title,
                author: row.book_author,
                date_read: date,
                rating: row.book_rating,
                genre: row.book_genre,
                isbn: row.book_isbn,
            }
            reads.push(reads_data);
        }
        return reads;
    } catch(error) {
        console.log('Error querying search');
        throw new Error('Failed querying search');
    }
}

// A function to retrieve book rating based on book id and user id
async function get_book_rating(book_id, user_id) {
    const result = await db.query('SELECT book_rating FROM readinglists WHERE  user_id = $1 AND book_id = $2', [user_id, book_id]);
    return result.rows[0];
}

// A function to update book details, the parameter passes newBook which contains the updated form and the summary
async function update_book_details (newBook, summary) {
    try {
        await db.query('UPDATE books SET book_title = $1, book_author = $2, publish_year = $3, book_genre = $4\
        WHERE book_id = $5',
        [newBook.book_title, newBook.book_author, newBook.publish_year, newBook.book_genre, newBook.book_id]);
        console.log("Update books table done!")
        await db.query('UPDATE summaries SET summary_text = $1 WHERE user_id = $2 AND book_id = $3', 
        [summary, currentUser, newBook.book_id]);
        console.log("Update Summary Done!");
        await db.query('UPDATE readinglists SET book_rating = $1 WHERE user_id = $2 AND book_id = $3', 
        [newBook.book_rating, currentUser, newBook.book_id]);
        console.log("Update Rating Done!");
    } catch(error) {
        console.log('Error Updating Book');
        throw new Error('Failed Updating book');
    }
}

// A function to delete selected reading list of the current user
async function delete_readings(book_id) {
    try {
        await db.query('DELETE FROM readinglists WHERE user_id = $1 AND book_id = $2',
        [currentUser, book_id]);
        console.log('Successfuly delete reading list');

        await db.query('DELETE FROM summaries WHERE user_id = $1 AND book_id = $2',
        [currentUser, book_id]);
        console.log('Successfuly delete summary');

    } catch(error) {
        console.log("Error deleting reading list");
        throw new Error("Failed deleting reading list");
    }
}

// Handles the initial landing page
app.get('/', async (req, res) => {
    try {
        const filterType = req.query.filterType; // Retrieve filter type from query parameters
        const reads = await get_user_reads(currentUser, filterType);
        const users = await get_users();
        const currentUserObject = getCurrentUserObject(users);
        if(users.length < 1) { // if there is no users available yet, page will render the add new user page
            res.render('initial.ejs');
            return;
        }
        res.render('index.ejs', {reads, users, currentUser: currentUserObject});
    } catch(error) {
        console.log("Error: ", error);
        res.status(500).send("Error Fetching Data");
    }   
});

/* Validates if the requested isbn is available or not, if it's available, then it will return image_data JSON,
else return
  */
app.get('/get-image-data/:isbn', async (req, res) => {
    const isbn = req.params.isbn;
    try {
        const image_data = await get_image_data(isbn);
        res.json(image_data);
    } catch (error) {
        console.error('Error fetching image data:', error);
        res.status(500).json({ error: 'Error fetching image data' });
    }
});

// Handles when user is trying to add or delete an account, else it will refresh the current user reading lists
app.post('/user', async (req, res) => {
    const userChoice = req.body.choice;
    if(userChoice == 'new') {
        res.render('new.ejs');
    } else if(userChoice == 'del') {
        await deleteUserAndData(currentUser);
        res.redirect('/');
    } else {
        try {
            currentUser = req.body.user;
            const reads = await get_user_reads(currentUser);
            const users = await get_users();
            const currentUserObject = getCurrentUserObject(users);
            res.render('index.ejs', {reads, users, currentUser: currentUserObject});
        } catch(error) {
            console.log("Error: ", error);
            res.status(500).send("Error Fetching Data");
        }
    }
});

// Handles when user is adding a new account
app.post('/new', async (req, res) => {
    try {
        const new_user_name = req.body.newUserInput;
        await insertName(new_user_name);
        console.log("New User Successfully added");
        // Retrieve the user_id of the newly inserted user
        const newUser = await db.query('SELECT user_id FROM users WHERE user_name = $1', [new_user_name]);
        if (newUser.rows.length === 0) {
            throw new Error('New user not found');
        }
        // Set currentUser to the user_id of the newly inserted user
        currentUser = newUser.rows[0].user_id;
        res.redirect('/');
    } catch (error) {
        console.error("Error inserting new user:", error);
        res.status(500).send("Error inserting new user");
    }
});

// Handles when user choose to read a book summary
app.post('/summary', async (req, res) => {
    try {
        const user_id = parseInt(req.body.user_id);
        const book_id = parseInt(req.body.book_id);
        const users = await get_users();

        const currentUserObject = getCurrentUserObject(users);

        // fetching book data
        const book_data = await getBookData(book_id);

        // fething summary
        const summary = await getSummary(user_id, book_id);

        if(!summary) {
            res.status(404).send('summary not found');
            return;
        }

        res.render('summary.ejs', {summary: summary.summary_text, book_data, currentUser: currentUserObject});

    } catch(error) {
        console.error("Error fetching summary:", error);
        res.status(500).send("Error fetching summary");
    }

});

// Handles when user adds a new book
app.post('/add-new-book', async (req, res) => {
    const newBook = {
        book_title: req.body.book_title_input,
        book_author: req.body.author_input,
        book_isbn: req.body.isbn_input.replace(/\D/g, ''), // replace any char that is not digit
        book_genre: req.body.select_genre,
        publish_year: req.body.book_publish_year,
        book_rating: req.body.book_rating,
    }
    const book_summary = req.body.summary;
    try {
        const isExistingBook = await insert_book_to_all_table(newBook, book_summary); // 
        res.redirect('/');
    } catch (error) {
        console.error('Error adding new book:', error);
        res.status(500).send({ status: false, message: 'Failed to add new book.' });
    }
})

// Seraching route handling
app.get('/search', async (req, res) => {
    try {
        const { query } = req.query; // extracting the request query params
        if (!query) {
            // Handle empty query
            return res.redirect('/');
        }
        const sanitizedQuery = `%${query.toLowerCase()}%`; // convert the searched query into lower case
        const reads = await searchResult(sanitizedQuery); // calling the search function, pass the sanitizedQuery
        const users = await get_users();
        const currentUserObject = getCurrentUserObject(users);
        res.render('index.ejs', { reads, users, currentUser: currentUserObject });
    } catch (error) {
        console.log('Error searching books:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// handles user request to edit a certain book detail and renders the edit page
app.post('/edit', async (req, res) => {
    try {
        const book_id = req.query.book_id; // extracting books id from req query params
        const user_id = req.query.user_id; // extracting user id form req query params
        
        if(!book_id && !user_id) {
            console.log("NO BOOK AND USER FOUND TO EDIT");
            return res.redirect('/');
        }

        const book_data = await getBookData(book_id);
        const summary = await getSummary(user_id, book_id);
        const book_rating = await get_book_rating(book_id, user_id);

        res.render('edit.ejs', {book_data, summary: summary.summary_text, book_rating: book_rating.book_rating});

    } catch(error) {
        console.log('Error fetching data');
        res.status(500).send('Error fetching data');
    }
})

// Updating book details in the database when user modifies it
app.post('/save-changes', async(req, res) => {
    const newBook = {
        book_id: req.body.book_id,
        book_title: req.body.book_title_input,
        book_author: req.body.author_input,
        book_genre: req.body.select_genre,
        publish_year: req.body.book_publish_year,
        book_rating: req.body.book_rating,
    }
    const summary = req.body.summary;

    await update_book_details(newBook, summary);
    res.redirect('/');
})

// Http request to handle when user deletes a post / reading list
app.post('/delete-post', async (req, res) => {
    const book_id = req.query.book_id
    await delete_readings(book_id);
    console.log("Redirecting to home page");
    res.redirect('/');
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});