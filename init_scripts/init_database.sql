CREATE TABLE users (
    userID INT PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    name VARCHAR(255),
    bio TEXT,
    profilePicture VARCHAR(255)
);