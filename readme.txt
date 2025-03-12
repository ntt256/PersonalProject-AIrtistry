* Online AI Art Marketplace * 

Description: 
    This project will be about building a website for an e-commerce site. This website will sell AI-generated art in different genres such as 
    nature, landscapes, technology, animals, and more. 
-----------------------------------------------------------------------------------------------------------------------
Requirements: 
    Back-end:
        *Node (index.js!)
        *Express
        *PostgreSQL (for database)
        *EJS (index.ejs)
        *Axios (for API)
        *Building our own API (api.js!)
    
    Front-end: 
        *Bootstrap (for footer, header)
        *HTML, CSS, JS
-----------------------------------------------------------------------------------------------------------------------
Steps: 
    Stage 1: Requirements:
        *Gather all the necessary back-end requirements and set up the environment.
        *Setup the back-end index.js file
-----------------------------------------------------------------------------------------------------------------------
    Stage 2: Design:
        *Design how I want the website to look. Make sure to think about the design of other tabs for the website.
        *Design the header and footer. 
        *Design the homepage 
        *Design the login/sign up page for users
        *Design the "shop" page and its items
        *Design the "profile" page

    ERRORS: 
    *The dropdown menu for the profile icon does not display all the listed dropdown's... I fixed it by modifying the Bootstrap code to its latest version 
    of 5.3

    *When creating partials such as footer.ejs and header.ejs with Bootstrap, you can only include the Bootstrap interactive function <script> ONLY in one of them. Inserting the 
    tag in both files will prevent it from working properly. This problem causes JS to conflict with itself since it is loaded multiple times. Additionally, include the Bootstrap CSS <link> only once too. You can include in both files, but 
    for best practices only once.
    
    *When designing the sign-up page, the Zip code's width goes beyond the border
    Solution: I had to refactor the classes of ZipCode to the ones that my existing FirstName, LastName has for everything to be the same

    *When creating the description boxes using <p> for each benefits box, I specified the font size to be 5px, but it did not work. The font size would appear as big as 
    20px.
    Solution: I fixed it by adding "!important".

    *When a user logs in, their initials should be displayed at the header instead of profile icon, however, the issue is that the texts only displays when I hover over it. 
    Solution: I had to play around with Bootstrap classes and rearranged them. Ex: originally, "class='btn primary" and changed it to "primary btn"
    
    *I had a problem of when a user that is logged in and wants to view their profile to see details such as their personal info or payments, they will have to click one of the options. When a user clicks on 
    one of them, the image icon for my company logo in header.ejs and my "Edit" pencil icon for editing user's personal info goes missing and just shows only the "alt".
    Solution: I changed the image file path " <img src="./images/cart.png" alt="shopping cart icon"> " by taking out the " . " before the " / " to make it absolute path. This works better for static files.
    -----------------------------------------------------------------------------------------------------------------------
    Stage 3: Development: 
         *Begin back-end development for setting up the log-in and sign-up page for users
         *Begin back-end development for our own API to handle PostgreSQL data such as user sign-up and login

    ERRORS: 
    *I had to replace the <a> of 'Login' and 'Signup' in the header with <input> because I wanted both buttons to direct me to 'login.ejs', 
    Solution: I tried adding <input> with 'hidden' but <a> tags only navigate to the assigned HREF, does not submit a form.

    *When a user log into their account, the profile icon in "header" should display their initials like "NT" and has an option to view profile. The problem is that currently our code for "login.ejs" we can only send data from client-side
    to the server-side, but we cannot render the information of the user for all pages since "header" is included in all pages. The goal is to send information of that user to the header, so all pages will have that information.
    Solution: We will use 'express session.' First, we will install it, by doing "npm i express-session" and use it by adding "app.use." Then, we will create our own middleware to handle user login. Express-sessions are very good for data persistence, and the session data is securely stored on the server. 

    * "Cannot read properties of undefined (reading 'slice')" this was an issue caused by you trying to access a value from an object{} that is undefined or does not exist
    Solution: Defined the missing value

    *I am trying to setup a password validation function() on 'login.ejs' file by surrounding it with EJS tags, and I included "<% var password = document.getElementById("password"); %>" but I get an error saying "document is not defined." This is caused by 
    me using <% tags but these tags are for server-side only. 'Document' only exists in the browser (front-end), so surrounding it with <% basically says "Server side doesn't recognize 'document'."
    Solution: By using <Script> it is using front-end

    *Another issue relating to password confirmation was that the 'setCustomValidity' message of "Password don't match" kept displaying even though both passwords matched. I could not even submit the form. 
    Solution: I removed the parenthesis () next to the function 'validatePassword.' This caused an issue with parenthesis because the function will execute immediately when the program runs, so the result of the function will be returned as a boolean value or true or false. 
    Instead, what we wanted was when an EventListenter was triggered the function will then execute by removing the parenthesis ().
    
    *An issue I faced while developing the API in particular was handling new user sign up information. I was trying to figure out a way to send the user's information to PostgreSQL database and this error came up, "error: invalid input syntax for type date:."
    Solution: I tried doing this "birthday: body.birthday || null" and it worked
    
    *Need to figure out a way to fix the issue of duplicate keys for username and email for SQL database
    Solution: If SQL sent back a "violates unique constraint" then we can handle that in 'index.js'

    *Having trouble querying data using "SELECT username, email, password FROM users." Experiencing several issues such as if I am even allowed to query with a "null" value.
    Solution: It turns out I am allowed to assign 'null' to a value when INSERT into SQL as well as using SELECT to search for 'null' values. The issue the whole time was because inside 
    PostgreSQL, user of ID 1 had a username with an extra space, which is why the query was unsuccessful. I used 'TRIM()' to fix it. 

    *When querying data of type 'date' from PostgreSQL using "SELECT", it comes out as "birthday: '2024-12-02T05:00:00.000Z'," so when I rendered it as an EJS value in 'profile.ejs,' it did not work. 
    Solution: I used "slice" to cut off the extra characters in the string. 

    *When a user is logged in and wants to edit their personal info, I faced an error with the front-side sending back both the original and new information of the user. I only want the new information.
    Solution: The problem was that I had placed the "Edit" <button> inside the <form> where it would be submitted. There were several ways to have fixed this problem. One method was to place the <button> outside of the <form>.
    Another method for solving this issue was to explicitly state <button type = button> because by default the button acts as "submit."

    *When trying to set up the code logic to delete a payment method from a user account, I used <form> to send in all the information regarding the payment method. The issue I was experiencing was that it would send in an empty object '{}.'
    I figured out that the issue was because I set an attrivute 'disabled' to the <input> so the key/value of it was not passed in.
    Solution: I removed the 'disabled' attribute from the <input> and replaced it with 'readonly' which makes it non-editable but passable to the req.body.

    *When working with adding shop items to a non-member's cart, I need to add all of the total amount of items together in order to get the quantity. I need to achieve this by turning the value into integer.
    Solution: I solved it by using 'Number()' and putting global variable outside the 'for' loop because it restarts all over when it loops again

    *When having 2 arrays, I am trying to figure out how I can check to see if the keys inside array X match with the array Y's keys. Then, if they both match, then it needs to merge to array Y. 
    Solution: I used map() to create a new array from the original array. I also used find() in order to find the matching itemID.

    *I had a problem with the <input> of type=checkbox. It wasn't working properly since it was inside a <form>.
    Solution: I used DOM to manipulate it by adding a 'onchange' to body to detect if the checkbox is checked or unchecked. 

    *Another key issue I had is when a logged-in user has credit card(s) saved on file, their card(s) should be displayed in the final checkout page in order to be used for payment. 
    This means that the DIV containing all the input fields for filling out an alternative payment method will be hidden. I tried clicking submit form but the form would not submit. I found out the issue was because although those input fields were hidden, they had 
    a required attribute which means they will prevent form submission if left empty. 
    Solution: I removed the attribute 'required' if the DIV was hidden. 