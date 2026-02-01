\c nearrish
CREATE TABLE users (
    userID INT PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    name VARCHAR(100),
    bio TEXT,
    profilePicture VARCHAR(255)
);