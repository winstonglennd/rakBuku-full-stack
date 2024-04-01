CREATE TABLE users(
	user_id SERIAL PRIMARY KEY,
	user_name varchar(50)
);

CREATE TABLE books(
	book_id SERIAL PRIMARY KEY,
	book_title varchar(50),
	book_author varchar(30),
	book_isbn VARCHAR(20),
	publish_year Integer,
    book_genre VARCHAR(20)
);

CREATE TABLE readingLists(
	list_id SERIAL PRIMARY KEY,
	date_read DATE,
	user_id INTEGER REFERENCES users(user_id),
	book_id INTEGER REFERENCES books(book_id),
    book_rating Decimal
);

CREATE TABLE summaries(
	summary_id SERIAL PRIMARY KEY,
	user_id INTEGER REFERENCES users(user_id),
    book_id INTEGER REFERENCES books(book_id),
	summary_text TEXT
);

DO $$
DECLARE
    max_user_id INTEGER;
    max_book_id INTEGER;
    max_list_id INTEGER;
    max_summary_id INTEGER;
BEGIN
    SELECT MAX(user_id) INTO max_user_id FROM users;
    SELECT MAX(book_id) INTO max_book_id FROM books;
    SELECT MAX(list_id) INTO max_list_id FROM readingLists;
    SELECT MAX(summary_id) INTO max_summary_id FROM summaries;

    PERFORM SETVAL('users_user_id_seq', max_user_id + 1);
    PERFORM SETVAL('books_book_id_seq', max_book_id + 1);
    PERFORM SETVAL('readinglists_list_id_seq', max_list_id + 1);
    PERFORM SETVAL('summaries_summary_id_seq', max_summary_id + 1);
END $$;