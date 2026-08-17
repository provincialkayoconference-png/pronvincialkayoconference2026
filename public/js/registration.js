const form = document.getElementById("registrationForm");
const dioceseSelect = document.getElementById("diocese");
const messageBox = document.getElementById("message");
const submitButton = document.getElementById("submitButton");


// ============================================
// LOAD DIOCESES
// ============================================
async function loadDioceses() {
    try {
        console.log("Loading dioceses...");

        const response = await fetch("/api/dioceses");

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Failed to load dioceses");
        }

        dioceseSelect.innerHTML =
            '<option value="">Select Diocese</option>';

        data.dioceses.forEach((diocese) => {
            const option = document.createElement("option");

            option.value = diocese.id;
            option.textContent = diocese.name;

            dioceseSelect.appendChild(option);
        });

        console.log(
            `${data.dioceses.length} dioceses loaded successfully`
        );

    } catch (error) {

        console.error("Error loading dioceses:", error);

        dioceseSelect.innerHTML =
            '<option value="">Unable to load dioceses</option>';
    }
}


// ============================================
// SHOW MESSAGE
// ============================================
function showMessage(text, type) {

    messageBox.textContent = text;

    messageBox.className =
        `message ${type}`;
}


// ============================================
// PAYMENT DETAILS
// ============================================
const paymentMethod =
    document.getElementById("payment_method");

const paymentSections = {
    CASH: document.getElementById("cash-details"),
    MPESA: document.getElementById("mpesa-details"),
    CHEQUE: document.getElementById("cheque-details"),
    BANK_TRANSFER: document.getElementById("bank-details")
};

const paymentInputs = {
    CASH: document.getElementById("cash_amount"),
    MPESA: document.getElementById("mpesa_code"),
    CHEQUE: document.getElementById("cheque_number"),
    BANK_TRANSFER: document.getElementById("bank_reference")
};


paymentMethod.addEventListener("change", function () {

    // Hide all payment detail sections
    Object.values(paymentSections).forEach(section => {

        if (section) {
            section.style.display = "none";
        }

    });


    // Remove required from all payment inputs
    Object.values(paymentInputs).forEach(input => {

        if (input) {
            input.required = false;
            input.value = "";
        }

    });


    const selectedMethod = this.value;


    // Show selected payment section
    if (paymentSections[selectedMethod]) {

        paymentSections[selectedMethod].style.display =
            "block";

    }


    // Make selected field required
    if (paymentInputs[selectedMethod]) {

        paymentInputs[selectedMethod].required =
            true;

    }

});


// ============================================
// SUBMIT REGISTRATION
// ============================================
form.addEventListener("submit", async (event) => {

    event.preventDefault();


    const full_name =
        document.getElementById("full_name").value.trim();

    const gender =
        document.getElementById("gender").value;

    const diocese_id =
        document.getElementById("diocese").value;

    const payment_method =
        document.getElementById("payment_method").value;


    // Payment details
    const cash_amount =
        document.getElementById("cash_amount").value;

    const mpesa_code =
        document.getElementById("mpesa_code").value.trim();

    const cheque_number =
        document.getElementById("cheque_number").value.trim();

    const bank_reference =
        document.getElementById("bank_reference").value.trim();


    submitButton.disabled = true;

    submitButton.textContent =
        "REGISTERING...";


    showMessage(
        "Submitting registration...",
        "loading"
    );


    try {

        const response = await fetch(
            "/api/registrations",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    full_name,

                    diocese_id,

                    gender,

                    payment_method,

                    cash_amount,

                    mpesa_code,

                    cheque_number,

                    bank_reference

                })
            }
        );


        const data =
            await response.json();


        if (data.success) {

            showMessage(
                `Registration successful! Your Registration Number is ${data.registration.registration_no}`,
                "success"
            );

            form.reset();

            // Hide payment sections after reset
            Object.values(paymentSections).forEach(section => {

                if (section) {
                    section.style.display = "none";
                }

            });

        } else {

            let errorMessage =
                data.message ||
                "Registration failed";


            if (data.registration_no) {

                errorMessage +=
                    ` Registration number: ${data.registration_no}`;

            }


            showMessage(
                errorMessage,
                "error"
            );

        }


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );

        showMessage(
            "Something went wrong. Please try again.",
            "error"
        );

    } finally {

        submitButton.disabled = false;

        submitButton.textContent =
            "REGISTER";

    }

});


// ============================================
// START
// ============================================
loadDioceses();