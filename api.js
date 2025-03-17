import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";

const app = express();
const port = 4000; 
env.config()

const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: 5432,
  });
  db.connect();

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json()); //this is needed since we're working with Axios

//starting the api
app.listen(port, ()=>{
    console.log(`API has started on port ${port}`);
});

//when a new user signs up for an account
app.post("/newUsersignUpForm", async (req, res) =>{
    let body = req.body;
    let newUserInfo = {
        firstName: body.firstName, //required
        lastName: body.lastName, //required
        phoneNumber: body.phoneNumber || null,
        birthday: body.birthday || null,
        username: body.username, //required
        email: body.email, //required
        password: body.password, //required
        residentialAddress: body.residentialAddress || null,
        city: body.city || null,
        americanState: body.americanState || null,
        zipCode: body.zipCode || null
    };

    try {
        let result = await db.query("INSERT INTO users(firstName, lastName, phoneNumber, birthday, username, email, password, address, city, state, zipCode, points)\n"
        + "VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *", [newUserInfo.firstName, newUserInfo.lastName, newUserInfo.phoneNumber, newUserInfo.birthday, newUserInfo.username, newUserInfo.email, newUserInfo.password, newUserInfo.residentialAddress, newUserInfo.city, newUserInfo.americanState, newUserInfo.zipCode, 0]);
        let data = result.rows; //all the information the user inputted
        res.json(data); //if INSERT into the table was successful, then send 'data' back to the server-side
    } catch (e){ //if unsuccessful
        console.error(e.stack);
        res.json(e.stack); //send the error message back to the server-side
    };
});

//when a returning user wants to log in
app.post("/userLogin", async (req, res) =>{
    let body = req.body;
    var isEmail = null;
    var isUsername = null;

    //checking to see if whether the user inputted a username or email
    if(body.usernameOrEmail.includes(".com")){
        isEmail = body.usernameOrEmail;
    } else{
        isUsername = body.usernameOrEmail;
    };

    try {
        let result = await db.query("SELECT * FROM users " +
            "WHERE (TRIM(username) = $1 OR TRIM(email) = $2) AND TRIM(password) = $3", [isUsername, isEmail, body.password]);
            let data = result.rows;
            res.json(data);

    } catch(e){ //if unsuccessful
        res.json(e.stack);
    };
});

//when a logged-in user wants to update their personal info
app.post("/updateUserPersonalInfo", async (req, res) =>{
    let body = req.body;
    try{
        let result = await db.query("UPDATE users " +
            "SET firstName = TRIM($1), lastName = $2, phoneNumber = $3, birthday = $4, email = $5, address = $6, city = $7, state = $8, zipCode = $9 WHERE userID = $10 RETURNING *", [body.firstName, body.lastName, body.phoneNumber, body.birthday, body.email, body.residentialAddress, body.city, body.americanState, body.zipCode, body.userID]);
            let data = result.rows;
            res.json(data);
    } catch(e){ //if unsuccessful
        res.json(e.stack);        
    };
});

//when a logged-in user clicks on 'Payments' tab, all payment methods should populate
app.post("/paymentsInfo", async (req, res) =>{
    let currentUser = req.body;
    try{
        let result = await db.query("SELECT payments.paymentID, payments.cardNumber, payments.cardType, payments.nickname " + 
            "FROM payments " +
            "INNER JOIN users on users.userID = payments.userID " +
            "WHERE users.userID = $1", [currentUser.userid]);
        let data = result.rows;
        res.json(data);
    } catch(e){
        console.error(e.stack);
    };
});

//when a logged-in user wants to add a new payment method
app.post("/addPaymentMethod", async (req, res) =>{
    let newPaymentMethod = req.body.body; //info of the new payment method
    let currentUser = req.body.currentUser; //info about the current logged-in user

    try{
        if((newPaymentMethod.cardType == "visa" || newPaymentMethod.cardType == "discover" || newPaymentMethod.cardType== "mastercard") && newPaymentMethod.creditCardNumber.length != 16){
            throw new Error(`Invalid card input.`);
        
        } else if(newPaymentMethod.cardType == "american express" && newPaymentMethod.creditCardNumber.length != 15){
            throw new Error("Invalid card input.");
        
        } else{
            let result = await db.query("INSERT INTO payments(userID, cardNumber, cardType, expirationDate, nickname, cardHolderName, securityCode) " +
            "VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *", [currentUser.userid, newPaymentMethod.creditCardNumber, newPaymentMethod.cardType, newPaymentMethod.expirationDate, newPaymentMethod.nickname ? newPaymentMethod.nickname : null, newPaymentMethod.cardHolderName, newPaymentMethod.securityCode]);
            let data = result.rows;
            res.json(data);
        };
    } catch(e){ //if unsuccessful
            console.error(e.stack);
            res.json(e.stack);
    };
});

//when a user clicks on a credit card to view its detailed info 
app.post("/detailedPaymentMethodInfo", async (req, res) =>{
    let paymentID = Number(req.body);
    try{
        let result = await db.query("SELECT * FROM payments " +
            "WHERE paymentID = $1", [paymentID]);
        let data = result.rows;
        res.json(data);
    } catch(e){
        console.error(e.stack);
    };
});

//when a logged in user wants to delete a payment method from their account
app.post("/deletePaymentMethod", async (req, res) =>{
    let paymentID = req.body.paymentID;
    try{
        let result = await db.query("DELETE FROM payments " +
            "WHERE paymentID = $1 RETURNING *", [paymentID]);
        let data = result.rows;
        res.json(data);

    } catch(e){
        console.error(e.stack);
        res.json(e.stack);
    };
});

//the purchase history of the user
app.post("/userPurchaseHistory", async (req, res) =>{
    try{
        const result = await db.query("SELECT orders.orderNumber, orders.dateOfPurchase, orders.totalPrice, orders.orderStatus, orders.paymentMethod, orders.pointsEarned, orderItems.itemID, orderItems.quantity, shopItems.title, shopItems.price " +
            "FROM orders " +
            "INNER JOIN orderItems ON orders.orderNumber = orderItems.orderNumber " +
            "INNER JOIN shopItems ON orderItems.itemID = shopItems.itemID " +
            "WHERE orders.userID = $1 " +
            "ORDER BY orders.dateOfPurchase DESC", [req.body.userID]);
        const data = result.rows;
        res.json(data);

    } catch(e){
        console.error(e.stack);
    };
});

//getting the total rewards (points) balance of the user and their available rewards
app.post("/getRewardsInfo", async (req, res) =>{
    const userID = req.body.userID;

    try{
        const [result, result2] = await Promise.all([
            db.query("SELECT points FROM users " +
                "WHERE userID = $1", [userID]), 
            db.query("SELECT couponCode, discountAmount FROM couponCodes " +
                "WHERE userID = $1", [userID])
        ]);
        const data = result.rows;
        const data2 = result2.rows;
        res.json({points: data, coupons: data2});
    
    } catch(e){
        console.error(e.stack);
    };
});

//checks to see if theres an already existing coupon code and if not, couponis created
app.post("/generateCoupon", async (req, res) =>{
    var couponDiscount = req.body.discountAmount
    var amount;
    var deductedPoints;

    if(couponDiscount.includes(10)){
        amount = 10;
        deductedPoints = 100;
    } else if(couponDiscount.includes(50)){
        console.log("50000")
        amount = 50;
        deductedPoints = 250;
    } else if(couponDiscount.includes("Hundred")){
        amount = 100;
        deductedPoints = 400;
    };

    //checks to see if there is already existing coupon in database
    try{
        const result = await db.query("SELECT couponCode FROM couponCodes " +
            "WHERE couponCode = $1", [req.body.coupon]);
        var data = result.rows;     
        res.json(data);

    } catch(e){
        console.error(e.stack);
    };

    //insert the new coupon code into couponCodes table and subtracts user's total points
    if(data.length == 0){
        try{
            const [result, result2] =  await Promise.all([
                db.query("INSERT INTO couponCodes(couponCode, haveUsed, discountAmount, userID) " +
                "VALUES($1, $2, $3, $4)", [req.body.coupon, false, amount, req.body.userID]),
                db.query("UPDATE users " +
                    "SET points = points - $1 " +
                    "WHERE userID = $2", [deductedPoints, req.body.userID])
            ]);

        } catch(e){
            console.error(e.stack);
    };
    };
});

//when a user enters a promo code before checkout, we need to check if it exists
app.post("/validatePromoCode", async (req, res) =>{
    try{
        const result = await db.query("SELECT couponCode, discountAmount FROM couponCodes " +
            "WHERE couponCode = $1", [req.body.promoCode]);
        const data = result.rows;
        res.json(data);
    
    } catch(e){
        console.error(e.stack);
    };
});

//deleting promo code if user used it on a purchase 
app.post("/deletePromoCode", async (req, res) =>{
    try{
        const result = await db.query("DELETE FROM couponCodes " + 
            "WHERE couponCode = $1", [req.body.promoCode]);
        res.json();
    
    } catch(e){
        console.error(e.stack);
    };
});

//delete user account 
app.post("/deleteAccount", async (req, res) =>{
    let userID = req.body.userid;
    try{
        let result = await db.query("DELETE FROM users " +
            "WHERE userID = $1 RETURNING *", [userID]);
        let data = result.rows;
        res.json(data);
    } catch(e){
        console.error(e.stack);
        res.json(e.stack);
    };
});

//changing the user's password
app.post("/changePassword", async (req, res) =>{
    let body = req.body;
    try{
        let result = await db.query("UPDATE users " + 
        "SET password = $1 " +
        "WHERE userID = $2 AND password = $3 RETURNING *", [body.newPassword, body.userID, body.currentPassword]);
        let data = result.rows;
        res.json(data);
    } catch(e){
        console.error(e.stack);
        res.json(e.stack);
    };
});

//accessing Shop
app.get("/shop", async (req, res) =>{
    try{
        let result = await db.query("SELECT * FROM shopItems");
        let data = result.rows;
        res.json(data);
    } catch(e){
        console.error(e.stack);
        res.json(e.stack);
    };
});

//when a user clicks on the shop item to view it with more details
app.get("/detailedItem/:itemid", async (req, res) =>{
    let itemID = req.params.itemid;
    try{
        let result = await db.query("SELECT * FROM shopItems " +
            "WHERE itemID = $1", [itemID]);
        let data = result.rows;
        res.json(data);
    } catch(e){
        console.error(e.stack);
    };
});

//adding a shop item to cart
app.post("/addToCart", async (req, res) =>{
    const itemID = req.body.itemID;
    const userID = req.body.userID;
    const quantity = req.body.quantity;

    if("userID" in req.body){
        try{
            let result = await db.query("INSERT INTO cart(userID, itemID, quantity) " +
                "VALUES($1, $2, $3) RETURNING *", [userID, itemID, quantity]);
            let data = result.rows;
            res.json(data);
    
        } catch(e){
            //if a user adds a shop item to their cart that already exists, it updates the quantity
            if(e.stack.includes(`error: duplicate key value violates unique constraint "cart_userid_itemid_key"`)){
                try{
                    let result = await db.query("UPDATE cart " +
                        "SET quantity = quantity + $1 " +
                        "WHERE userID = $2 AND itemID = $3 RETURNING *", [quantity, userID, itemID]);
                    let data = result.rows;
                    res.json(data);
                } catch(e){
                console.error(e.stack);
               };            
            };
            console.error(e.stack);
        };
    };
});

//getting the total amount of items in cart of the logged-in user... ex 26 items in cart
app.post("/cartQuantity", async (req, res) =>{
    const userID = req.body.userID;
    try{
        let result = await db.query("SELECT quantity FROM cart " +
            "WHERE userID = $1", [userID]);
        try{//deleting item from cart if quantity = 0
            let result = db.query("DELETE FROM cart " + 
                "WHERE quantity = 0");
        } catch(e){
            console.error(e.stack);
        };
        let data = result.rows;
        res.json(data);
    } catch(e){
        console.error(e.stack);
    };
});

//retrieving all items in the user's cart
app.post("/shoppingCart", async (req, res) =>{
    const userID = req.body.id;
    if(userID){ //logged-in user
        try{
            const result = await db.query("SELECT title, price, shopItems.itemID, cart.quantity " +
            "FROM shopitems " + 
            "INNER JOIN cart ON shopItems.itemID = cart.itemID " + 
            "WHERE cart.userID = $1", [userID]);
            const data = result.rows;
            res.json(data);
        } catch(e){
            console.error(e.stack);
        };
    } else{ //non-logged in user
        const cart = req.body;
        const itemIDs = cart.map(e => Number(e.itemID));
        const result = await db.query("SELECT title, price, itemID " + 
            "FROM shopItems " + 
            "WHERE itemID = ANY($1::int[])", [itemIDs]); //Casts into integer array and 'any' takes all those numbers and checks in table
        const data = result.rows;
        res.json(data);
    };
});

//modifying the item's quantity in the user's cart
app.post("/modifyCartItemQuantity/:itemID", (req, res) =>{
    let itemID = req.params.itemID;
    if(req.body.includes("add")){
        modifyItemQuantity(itemID, "add");
    } else if(req.body.includes("minus")){
        modifyItemQuantity(itemID, "minus")
    } else{
        modifyItemQuantity(itemID);
    };
    res.json();
});

//checks for all existing order numbers in order to create a new one
app.get("/orderNumber", async (req, res) =>{
    try{
        const result = await db.query("SELECT orderNumber FROM orders");
        const data = result.rows;
        res.json(data);
    } catch(e){
        console.error(e.stack);
    };
});

//when a user places an order
app.post("/placeOrder", async (req, res) =>{
    var orderInfo = req.body;
    var pointsEarned = Math.round(Number(orderInfo.cost.total) / 500);

    try{   
        const [result, result2, result3] = await Promise.all([
            db.query("INSERT INTO orders(orderNumber, userID, lastName, dateOfPurchase, totalPrice, shippingCost, paymentMethod, pointsEarned) " +
            "VALUES($1, $2, $3, $4, $5, $6, $7, $8)", [orderInfo.orderNumber, orderInfo.userID == "" ? null : orderInfo.userID, orderInfo.lastName.toUpperCase(), req.body.dateOfPurchase, orderInfo.cost.total, orderInfo.cost.shippingCost, (orderInfo.memberPaymentMethodSelection && orderInfo.memberPaymentMethodSelection != 'other' ? orderInfo.memberPaymentMethodSelection : orderInfo.cardType + " " + orderInfo.creditCardNumber.substring(orderInfo.creditCardNumber.length - 4)), pointsEarned]),
            db.query("DELETE FROM cart " + //emptying logged-in user's cart
            "WHERE userID = $1", [orderInfo.userID != "" ? orderInfo.userID : null]),
            db.query("UPDATE users " +
                "SET points = points + $1", [pointsEarned])
        ]);

            await modifyOrderStatus("Processing", orderInfo.orderNumber);
            await saveOrderItems(orderInfo.cart, orderInfo.orderNumber);
            await updateShopItemQuantitySold(orderInfo.cart);
            res.json(pointsEarned);
        } catch(e){
            console.error(e.stack);
        };
});

//tracking an order
app.post("/trackOrder", async (req, res) =>{
    try{
        const result = await db.query("SELECT dateOfPurchase, orderStatus " +
            "FROM orders " +
            "WHERE orderNumber = $1 AND lastName = $2", [req.body.orderNumber, req.body.lastName.toUpperCase()])
        const data = result.rows;
        res.json(data);

    } catch(e){
        console.error(e.stack);
    };
});


// **ALL FUNCTIONS** //
//helper function for modifying item quantity in user's cart
async function modifyItemQuantity(itemID, modification){
    if(modification == "add"){
        try{
            let result = await db.query("UPDATE cart " + 
                "SET quantity = quantity + $1 " +
                "WHERE itemID = $2", [1, itemID]);
        } catch(e){
            console.error(e.stack);
        };
    } else if(modification == "minus"){
        try{
            let result = await db.query("UPDATE cart " + 
                "SET quantity = quantity - $1 " +
                "WHERE itemID = $2", [1, itemID]);
        } catch(e){
            console.error(e.stack);
        };
    } else{
        let result = await db.query("DELETE FROM cart " + 
            "WHERE itemID = $1", [itemID]);
    };
};

//updating the quantity of the shop item(s) whenever a user places an order containing that item(s)
async function updateShopItemQuantitySold(cart){
    cart = cart.map(e =>{ 
        if(e.itemID){
            const {itemID, ...rest} = e; // Destructure to extract itemID
            return { ...rest, itemid: itemID };
        };
        return e;
    });

    for(let i = 0; i < cart.length; i++){
        try{
            const result = await db.query("UPDATE shopitems " + 
                    "SET quantitySold = quantitySold + $1 " +
                    "WHERE itemID = $2", [cart[i].quantity, cart[i].itemid]);
        } catch(e){
            console.error(e.stack);
        };
    };
};

//modifying the status message of the order.. ex) "processing", "delivered"
async function modifyOrderStatus(orderStatus, orderNumber){
    try{
        const result = await db.query("UPDATE orders " + 
            "SET orderStatus = $1 " +
            "WHERE orderNumber = $2", [orderStatus, orderNumber])
    } catch(e){
        console.error(e.stack);
    };
};

//storing the items into orderItems table after a user has placed an order. This is useful for when we want to find out what items are in an order
async function saveOrderItems(cart, orderNumber){
    cart = cart.map(e =>{
        if(e.itemID){
            const {itemID, ...rest} = e;
            return {...rest, itemid: itemID};
        };
        return e;
    });

    for(let i = 0; i < cart.length; i++){
        try{
            const result = await db.query("INSERT INTO orderItems(orderNumber, itemID, quantity) " +
                "VALUES($1, $2, $3)", [orderNumber, cart[i].itemid, cart[i].quantity]);
        } catch(e){
            console.error(e.stack);
        };
    };
};
