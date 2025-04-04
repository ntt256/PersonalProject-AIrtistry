import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import session from "express-session";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import env from "dotenv";

const app = express();
const port = 3000; 
const __dirname = dirname(fileURLToPath(import.meta.url));
const apiURL = "http://localhost:4000";
env.config()
var cart = []; //non-logged in user's cart

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public")); //for our CSS styling
app.use('/bootstrap', express.static(__dirname + '/node_modules/bootstrap/dist'));
app.use(session({ //this middleware is used for login session of a user
    secret: process.env.SESSION_SECRET, //secret key used to sign the session ID cookie to ensure that the session data is secure
    resave: false, // Don't save session if unmodified
    saveUninitialized: true    // Save new sessions even if they haven't been modified
}));

//our custom middleware which runs on every HTTP request... makes 'user' available on every EJS we render
app.use(async (req, res, next) => {
    res.locals.user = req.session.user || null;

    if(res.locals.user != null){ //logged-in user
        if(req.session.nonMember){ //if a user logged in, destroy the non-logged in user's session
            delete req.session.nonMember;
        };

        const user = res.locals.user;
        let cartQuantity = await calculateCartQuantity(user);
        res.locals.user.cartQuantity = cartQuantity;
        
    } else{ //non logged-in user
        let nonMemberCartQuantity = await calculateCartQuantity();
        if(!req.session.nonMember){
            req.session.nonMember = {nonMember: true}
        }
        req.session.nonMember.cart = nonMemberCartQuantity;
        res.locals.nonMember = req.session.nonMember
    };
    next();
});

//starting the server
app.listen(port, ()=>{
    console.log(`Server has started on port ${port}`);
});

//homepage
app.get("/", (req, res) =>{
    res.render("index.ejs")
});

//when a user wants to get to login or sign-up page 
app.post("/credentials", (req, res) =>{
    if(req.body.isLogin == "Log In"){
        res.render("login.ejs", {loginPage: true});
    } else{ // user sign-up page
        res.render("login.ejs", {signUpPage: true})
    };
});

//when a new user signs up for an account
app.post("/newUsersignUpForm", async (req, res) =>{
    let body = req.body;

    try {
        const response = await axios.post(apiURL + "/newUsersignUpForm", body);
        const data = response.data;
        
        if(data.includes(`error: duplicate key value violates unique constraint "users_username_key"`)){
            throw new Error("Username already exists! Please use a different one.");

        } else if (data.includes(`error: duplicate key value violates unique constraint "users_email_key"`)){
            throw new Error("Email already exists! Please use a different one.")

        } else if (data.includes(`error: duplicate key value violates unique constraint "users_phonenumber_key"`)){
            throw new Error("Phone number already exists! Please use a different one.")
        
        } else{
            res.render("login.ejs", {afterSignUpPage: true, userFirstName: body.firstName});
        }
      
    } catch (e) {
        res.render("login.ejs", {
            signUpPage: true,
            signUpErrorMessage: e.message,
            userInput: body});
      };
});

//when a returning user wants to log in 
app.post("/userLogin", async (req, res) =>{
    let body = req.body;
    try {
        const response = await axios.post(apiURL + "/userLogin", body);
        const data = response.data;

        if(data.length == 0){ //if no login record matches
            throw new Error("Email/Username and/or password is incorrect.")
        } else { //if login successful
            req.session.user = data[0];
            res.redirect("/");
        };
    
    } catch(e){
        res.render("login.ejs", {
            loginErrorMessage: e.message,
            userInput: body,
            loginPage: true
        });
    };
});

//when a user is logged in, they can logout
app.get("/signOut", (req, res) =>{
        req.session.destroy((error) =>{ //clears session data
            if(error){
                console.error("Error logging out: " + error);
            } else{
                res.redirect("/");
            };
        });
    });

//when a user is logged in, they can view their profile. On default, personal info should populate
app.get("/viewProfile", (req, res) =>{
    res.render("profile.ejs", {personalInfoTab: true})
});

//View profile options
app.post("/viewProfile/tabs", (req, res) =>{
    let tab = Object.keys(req.body); //the keys of the object

    if(tab == "personal"){
        res.redirect("/personalInfo");
    
    } else if(tab == "payments"){
        res.redirect("/paymentsInfo");
    
    } else if(tab == "purchaseHistory"){
        res.redirect("/purchaseHistoryInfo");
    
    } else if(tab == "rewards"){
        res.redirect("/rewardsInfo");
    
    } else{
        res.redirect("/accountOwnershipInfo");
    };
});

//Personal Info tab
app.get("/personalInfo", (req, res) =>{
    res.render("profile.ejs", {personalInfoTab: true})
});

//when a user wants to update their Personal Info
app.post("/updateUserPersonalInfo", async (req, res) =>{
    let currentUserInfo = req.session.user;
    let newUserInfo = req.body; //the personal info user just changed
    let updatedInfo = newUserInfo;
    updatedInfo.userID = currentUserInfo.userid

    try {
        const response = await axios.post(apiURL + "/updateUserPersonalInfo", updatedInfo);
        const data = response.data; //the API sends back either an error message or the object
        if(data.includes(`error: duplicate key value violates unique constraint "users_email_key"`)){
            throw new Error("Email already exists! Please use a different one.");

        } else if(data.includes(`error: duplicate key value violates unique constraint "users_phonenumber_key"`)){
            throw new Error("Phone number already exists! Please use a different one.");
        
        } else{ //if successful
            req.session.user = data[0]; //updating session.user
            res.redirect("/viewProfile");
        };     
    } catch(e){
        res.render("profile.ejs", {
            error: e.message,
            personalInfo: true
        });
    };
});

//Payments tab... all the payment methods of the logged-in user should populate
app.get("/paymentsInfo", async (req, res) =>{
    let userInfo = req.session.user;
    try{
        const response = await axios.post(apiURL + "/paymentsInfo", userInfo);
        const data = response.data; //an array of credit cards
        res.render("profile.ejs", {
        paymentsInfoTab: true,
        payments: data
    });
} catch(e){
        console.error(e.stack);
    };
});

//when a user is logged in, they can add a payment method in Payments tab
app.post("/addPaymentMethod", async (req, res) =>{
    let body = req.body;
    let currentUser = req.session.user;
    if("addNewCard" in body){ //when user clicks on "Add new card" in Payments tab
        res.render("profile.ejs", {addPaymentMethod: true})
        
    } else { //when user submits the information of the new credit card
        try{
            const response = await axios.post(apiURL + "/addPaymentMethod", 
                {body: body,
                currentUser: currentUser});
            const data = response.data;

            if(data.includes(`error: duplicate key value violates unique constraint "payments_cardnumber_key"`)){
                throw new Error("This card already exists in file. Please use a different payment method!");
            
            } else if(data.includes(`Error: Invalid card input.`)){
                throw new Error(`Invalid ${body.cardType.toUpperCase()} card input.`);
            
            } else{ //if successful
                res.redirect("/paymentsInfo");
            };
        } catch(e){
            res.render("profile.ejs", {
                errorMessage: e.message,
                userInput: body,
                addPaymentMethod: true
            });
        };
    };
});

//when a user clicks on a payment method to get its detailed info
app.post("/detailedPaymentMethodInfo", async (req, res) =>{
    let paymentID = Object.keys(req.body);
    try{
        const response = await axios.post(apiURL + "/detailedPaymentMethodInfo", paymentID); 
        const data = response.data[0];
        res.render("profile.ejs", {
            detailedPaymentMethodInfo: true,
            creditCard: data
            });
    } catch(e){
        console.error(e.stack);
    };
});

//when a logged in user wants to delete a payment method from their account
app.post("/deletePaymentMethod", async (req, res) =>{
    let body = req.body;
    try{
        const response = await axios.post(apiURL + "/deletePaymentMethod", body); 
        res.redirect("/paymentsInfo");
    } catch(e){
        console.error(e.stack);
    };
});

//user's purchase history
app.get("/purchaseHistoryInfo", async (req, res) =>{
    const userID = req.session.user ? req.session.user.userid : undefined;
    if(userID){
        try{
            const response = await axios.post(apiURL + "/userPurchaseHistory", {userID: userID}); 
            var data = response.data;

            data = data.reduce((accumulator, item) =>{
                let orderNumber = item.ordernumber;
                if(!accumulator[orderNumber]){ //if no order # yet, create an order #
                  accumulator[orderNumber] = {orderNumber: item.ordernumber, dateOfPurchase: item.dateofpurchase, totalPrice: item.totalprice, orderStatus: item.orderstatus, paymentMethod: item.paymentmethod, pointsEarned: item.pointsearned,
                    items: [{itemID: item.itemid, title: item.title, price: item.price, quantity: item.quantity}]}
                };
              
                const doesNotExistInOrder = element => element.itemID != item.itemid;
              
                if(accumulator[orderNumber].items.some(doesNotExistInOrder)){
                    accumulator[orderNumber].items.push({itemID: item.itemid, title: item.title, price: item.price, quantity: item.quantity})
                }
                return accumulator;
            }, {});

            const orders = Object.values(data);
            // console.log(orders)
            // console.log(orders[0].items)
            res.render("profile.ejs", {purchaseHistoryTab: true, orders: orders});

        } catch(e){
            console.error(e.stack);
        };
    };
    
});

//Inside purchase history, user can view the order with more details 
app.post("/viewOrderDetails", (req, res) =>{
    const orderInfo = JSON.parse(Object.values(req.body));
    res.render("profile.ejs", {purchaseHistoryTab: true, viewOrderDetails: true, order: orderInfo});
});

//User's rewards tab 
app.get("/rewardsInfo", async (req, res) =>{
    try{
        const userID = req.session.user.userid;
        const response = await axios.post(apiURL + "/getRewardsInfo", {userID: userID}); 
        const data = response.data;
        var userRewardPoints = data.points[0].points;
        var userAvailableCoupons = data.coupons;
        res.render("profile.ejs", {rewardsInfoTab: true, userRewardPoints: userRewardPoints, userAvailableCoupons: userAvailableCoupons});

    } catch(e){
        console.error(e.stack);
    };
});

//Inside user's rewards tab: When a user has enough points, they can redeem a coupon code
app.post("/getCouponCode", async (req, res) =>{
    if(res.locals.user){
        const userID = res.locals.user.userid;
        var body = Object.keys(req.body);
        await generateCouponCode(body[1], userID);
    };
    res.redirect("/rewardsInfo")
});

//Account Ownership tab
app.get("/accountOwnershipInfo", (req, res) =>{
    res.render("profile.ejs", {accountOwnershipTab: true});
});

//when a user wants to get to the account deletion page
app.get("/deleteAccountPage", (req, res) =>{
  res.render("profile.ejs", {deleteAccountPage: true});
});

//delete account 
app.get("/deleteAccount", async (req, res) =>{
    let user = req.session.user;
    try{
        const response = await axios.post(apiURL + "/deleteAccount", user); 
        req.session.destroy();
        res.redirect("/");
    } catch(e){
        console.error(e.stack);
    };
});

//when a user wants to get to the change password page
app.get("/changePasswordPage", (req, res) =>{
    res.render("profile.ejs", {changePasswordPage: true});
});

//changing password
app.post("/changePassword", async (req, res) =>{
    let body = req.body;
    body.userID = req.session.user.userid;
    try{
        const response = await axios.post(apiURL + "/changePassword", body);
        const data = response.data;
        if(data.length == 0){ //if current pass incorrect
            throw new Error("Current password is incorrect.")
        } else{ //if successful
            res.render("profile.ejs", {
                changePasswordPage: true,
                message: "Password changed successfully!"});
        };
    } catch(e){ //if unsuccessful
        res.render("profile.ejs", {
            changePasswordPage: true,
            errorMessage: e.message}); //redirects back to 'Change password' page
    };
});

//when a user clicks on "Shop" in header to access the shop... all shop items should populate
app.get("/shop", async (req, res) =>{
    try{
        const response = await axios.get(apiURL + "/shop");
        const data = response.data;
        res.render("shop.ejs", {shopItems: data});
    } catch(e){
        console.log(e.stack);
    }
});

//when a user clicks on an item in the Shop to view more details about it
app.get("/detailedShopItem/:itemid", async (req, res) =>{
    try{
        const response = await axios.get(apiURL + "/detailedItem/" + req.params.itemid);
        const data = response.data[0];
        res.render("shop.ejs", {
            detailedShopItemPage: true,
            shopItem: data});

    } catch(e){
        console.error(e.stack);
    };
});

//adding a shop item to cart
app.post("/addToCart", async (req, res) =>{
    let userID = req.session.user ? req.session.user.userid : undefined;
    let body = req.body;
    
    if(userID){ //logged-in user adding items to cart 
        body.userID = userID;
        try{
            const response = await axios.post(apiURL + "/addToCart", body);
            const data = response.data[0];
            res.redirect("/detailedShopItem/" + body.itemID);
        } catch(e){
            console.error(e.stack);
        };
    } else{ //non-logged in users adding items to cart
        addToCart(body);
        res.redirect("/detailedShopItem/" + body.itemID);
    };
});

//accessing user's cart to view all items in cart
app.get("/shoppingCart", async (req, res) =>{
    var subtotal = 0;
    var shippingCost;
    var estimatedTotal = 0;
    let userID = req.session.user ? req.session.user.userid : undefined;
    const viewCart = true;
    var promoCodeError;

    //setting a temporary invalid promo code message
    if(req.session.user && req.session.user.promoCodeError){
        promoCodeError = req.session.user.promoCodeError;
        delete req.session.user.promoCodeError;
    } else if(req.session.nonMember && req.session.nonMember.promoCodeError){
        promoCodeError = req.session.nonMember.promoCodeError;
        delete req.session.nonMember.promoCodeError;
    };
    req.session.save();

    if(userID){ //logged-in user's cart items
        try{
            const response = await axios.post(apiURL + "/shoppingCart", {id: userID});
            const data = response.data;
            subtotal = calculateCartSubtotal(data);
            estimatedTotal = subtotal;
            
            if(req.session.user.promoCodeDiscount){ //if user applied promo code
                estimatedTotal = estimatedTotal - req.session.user.promoCodeDiscount.discountamount;
            };
            shippingCost = calculateShippingCost("member");
            res.render("checkout.ejs", {viewCart: viewCart, memberCartItems: data, subtotal: subtotal, shippingCost: shippingCost, estimatedTotal: estimatedTotal, promoCodeError: promoCodeError});
        
        } catch(e){
            console.error(e.stack);
        };
    } else{ //non-logged in user's cart items
        try{
            const response = await axios.post(apiURL + "/shoppingCart", cart);
            let data = response.data;
            //below, we are transferring the item's title and price to the user's cart of the associated itemID in order to be displayed in front-end
            cart = cart.map(e =>{
                let foundItemID = data.find(c => c.itemid == e.itemID);
                return {...e, title: foundItemID.title, price: foundItemID.price} //returns the itemID with its associated title, price
              });
            
            for(let i = 0; i < cart.length; i++){ //removing item from cart if quantity = 0
                if(cart[i].quantity == 0){
                    cart.splice(i, 1);
                    i--;
                    continue;
                };
            };

            subtotal = calculateCartSubtotal(cart);
            estimatedTotal = subtotal;

            if(req.session.nonMember.promoCodeDiscount){ //if user applied promo code
                estimatedTotal = estimatedTotal - req.session.nonMember.promoCodeDiscount.discountamount;
            }
            shippingCost = calculateShippingCost(false, subtotal);
            if(shippingCost === "$50"){
                estimatedTotal += 50;
            };
            res.render("checkout.ejs", {viewCart: viewCart, nonMemberCartItems: cart, subtotal: subtotal, shippingCost: shippingCost, estimatedTotal: estimatedTotal, promoCodeError: promoCodeError});
        
        } catch(e){
            console.error(e.stack);
        };
    };
});

//modifying the item's quantity in the user's cart
app.post("/modifyCartItemQuantity/:itemID", async (req, res) =>{
    const quantityControls = Object.keys(req.body);
    if(quantityControls.includes("loggedInUser")){//logged-in user
        try{
            const response = await axios.post(apiURL + "/modifyCartItemQuantity/" + req.params.itemID, quantityControls);
            res.redirect("/shoppingCart");
        } catch(e){
            console.error(e.stack);
        };
    } else {
        const foundItemID = cart.findIndex(e => e.itemID == req.params.itemID);
        if(quantityControls.includes("add")){
            cart[foundItemID].quantity = cart[foundItemID].quantity + 1;
        } else if(quantityControls.includes("minus")){
            cart[foundItemID].quantity = cart[foundItemID].quantity - 1;
        } else{
            cart.splice(foundItemID, 1);
        };
        res.redirect("/shoppingCart");
    };
});

//when a user enters a promo code before checkout
app.post("/validatePromoCode", async (req, res) =>{
    try{
        const response = await axios.post(apiURL + "/validatePromoCode", {promoCode: req.body.promoCode});
        const data = response.data[0];
        
        if(data != undefined){ //if valid promo code
            if(req.session.user){//attach promo code to logged-in user
                req.session.user.promoCodeDiscount = data;
                if(req.session.user.promoCodeError){
                    delete req.session.user.promoCodeError
                };

            } else{ //attach promo code to non logged-in user
                req.session.nonMember.promoCodeDiscount = data;
                if(req.session.nonMember.promoCodeError){
                    delete req.session.nonMember.promoCodeError;
                };
            };
        } else{ //invalid promo code
            if(req.session.user){
                req.session.user.promoCodeError = "Invalid promo code!";
            } else{
                req.session.nonMember.promoCodeError = "Invalid promo code!";
            };
        };
        req.session.save();
        res.redirect("/shoppingCart");

    } catch(e){
        console.error(e.stack);
    };
});

//if user changes mind and no longer wants to use the promo code
app.post("/removePromoCode", (req, res) =>{
    removePromoCode(req.session.user, req.session.nonMember);
    res.redirect("/shoppingCart");
});

//checkout page 
app.post("/checkout", async (req, res) =>{
    let cost = req.body;
    let userID = req.session.user ? req.session.user.userid : undefined;
    
    if(cost.shippingCost != 'FREE'){
        cost.total = Number(cost.estimatedTotal) + 50;
    } else{
        cost.total = cost.estimatedTotal;
    };

    if(userID){ //logged-in user's cart items and payment methods
        try{
            const [response, response2] = await Promise.all([
                axios.post(apiURL + "/shoppingCart", {id: userID}), //user's cart items
                axios.post(apiURL + "/paymentsInfo", {userid: userID})]); //user's credit cards
            
            const [data, data2] = [response.data, response2.data];  
            res.render("checkout.ejs", {checkout: true, memberCartItems: data, memberPaymentMethods: data2, cost: cost});
        
        } catch(e){
            console.error(e.stack);
        };
    } else{//non logged-in user's cart items
        res.render("checkout.ejs", {checkout: true, nonMemberCartItems: cart, cost: cost})
    };
});

//when a user places an order 
app.post("/placeOrder", async (req, res) =>{
    const date = getCurrentDate();
    const orderNumber = await generateOrderNumber();
    var orderInfo = req.body;
    var appliedPromoCode = (req.session.user && (req.session.user.promoCodeDiscount ? req.session.user.promoCodeDiscount.couponcode : null)) || (req.session.nonMember && (req.session.nonMember.promoCodeDiscount ? req.session.nonMember.promoCodeDiscount.couponcode : null));
    
    orderInfo.cart = JSON.parse(orderInfo.cart);
    orderInfo.cost = JSON.parse(orderInfo.cost);
    orderInfo.dateOfPurchase = date;
    orderInfo.orderNumber = orderNumber;

    //if user used promo code on purchase, delete the promo code from database
    if(appliedPromoCode != null || undefined){
        try{
            removePromoCode(req.session.user, req.session.nonMember);
            const response = await axios.post(apiURL + "/deletePromoCode", {promoCode: appliedPromoCode});

        }catch(e){
            console.error(e.stack);
        };
    };

    //places order
    try{
        const response = await axios.post(apiURL + "/placeOrder", orderInfo);
        orderInfo.pointsEarned = response.data; //total points earned from order
        
        //emptying cart
        if(orderInfo.userID == ""){
            cart = [];
            res.locals.nonMember.cart = 0;
        } else{
            req.session.user.cartQuantity = 0;
        }
        req.session.save(); //ensures that the session is updated before rendering()
        res.render("checkout.ejs", {orderPlaced: true, orderInfo: orderInfo})

    } catch(e){
        console.error(e.stack);
    };
});

//track an order page
app.get("/trackOrderPage", (req, res) =>{
    res.render("support.ejs", {trackOrderPage: true});
});

//tracking an order 
app.post("/trackOrder", async (req, res) =>{
    try{
        const response = await axios.post(apiURL + "/trackOrder", req.body);
        var data = response.data[0];
        if(data != undefined){
            data.orderNumber = req.body.orderNumber;
        }
        res.render("support.ejs", {trackOrderResultPage: true, order: data});
    } catch(e){
        console.error(e.stack);
    };
});

//about us page 
app.get("/aboutUs", (req, res) =>{
    res.render("about.ejs");
});

//FAQ page 
app.get("/faq", (req, res) =>{
    res.render("support.ejs", {faqPage: true});
});

//contact-us page 
app.get("/contact", (req, res) =>{
    res.render("support.ejs", {contactPage: true});
});

// **ALL FUNCTIONS** //
//calculating the subtotal in both the logged-in and non-logged in user's cart
function calculateCartSubtotal(cart){
    var subtotal = 0;
    for(let i = 0; i < cart.length; i++){
        subtotal += cart[i].quantity * Number(cart[i].price);
    }
    return subtotal;
};

//calculating the shipping cost. Non-member's will have to pay shipping cost if order subtotal is $10,000<
function calculateShippingCost(isMember, subtotal){
    if(isMember){
        return "FREE";
    } else if(subtotal >10000){
        return "FREE";
    } else{
        return "$50";
    };
};

//helper function: adding a shop item to a non-logged in user's cart
function addToCart(item){
    if(item){
        const foundItem = cart.findIndex(e => e.itemID === item.itemID);
        if(foundItem != -1){ //if item already exists in cart
            cart[foundItem].quantity = Number(cart[foundItem].quantity) + Number(item.quantity);
        } else {
        cart.push({...item, quantity: Number(item.quantity)});
        };
    };
  };

  //helper function calculating the total items in the logged-in and non-logged in user's cart
  async function calculateCartQuantity(user){
    var cartQuantity;
    if(user){ //logged-in user
        cartQuantity = 0;
        try{
            const response = await axios.post(apiURL + "/cartQuantity/", {userID: user.userid});
            const data = response.data;
            for(let i = 0; i < data.length; i++){
                cartQuantity += data[i].quantity;
            };
            return cartQuantity;
        } catch(e){
            console.error(e.stack);
        };
    } else{ //non logged-in user
        cartQuantity = 0;
        for(var i = 0; i < cart.length; i++){
            cartQuantity += Number(cart[i].quantity);
        };
        return cartQuantity;
    };
};

//prints out the current date in YYYY-MM-DD format after an order has been placed by the user
function getCurrentDate(){
    let date = new Date();
    return date;
};

//generating an order number after an order has been placed by the user
async function generateOrderNumber(){
    var orderNumber = Math.random().toString().slice(2,16);

    try{
        const response = await axios.get(apiURL + "/orderNumber");
        let data = response.data;
        data = data.map(e => Number(e.ordernumber)) //remapping the array to extract only order numbers as 'integer' values
        const foundOrderNumber = data.find(e => e == orderNumber);

        if(foundOrderNumber != undefined){ //order number already exists
            return await generateOrderNumber(); 
        } else{
            return orderNumber;
        };
    } catch(e){
        console.error(e.stack);
        return null; //if error is caught, this is the return value. Ex) API call failed
    };
};

//For members: it generates a coupon code for users to redeem
async function generateCouponCode(discountAmount, userID){
    var couponCode = "";
    const letters = "ADBCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomNumbers = Math.random().toString().substring(2,16);

    //first, it creates a coupon code
    for(let i = 0; i < 10; i++){
        const randomLetterIndex = Math.floor(Math.random() * letters.length);
        couponCode += randomNumbers.charAt(i) + letters.charAt(randomLetterIndex);
    };

    //then, checks to see if theres one already existing
    try{
        const response = await axios.post(apiURL + "/generateCoupon", {coupon: couponCode, discountAmount: discountAmount, userID: userID});
        const data = response.data;

        if(data.length == 0){ //if no existing coupon code matches a newly created one
            return couponCode;
        } else{
            return await generateCouponCode();
        };

    } catch(e){
        console.error(e.stack);
        return null;
    };
};

//if user no longer wants to use that promo code OR if they placed an order using that promo code
function removePromoCode(member, nonMember){
    if(member && member.promoCodeDiscount){
        delete member.promoCodeDiscount;
    } else if(nonMember && nonMember.promoCodeDiscount){
        delete nonMember.promoCodeDiscount;
    };
};
