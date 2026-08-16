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

        console.log("API response status:", response.status);

        if (!response.ok) {
            throw new Error(
                `Server returned ${response.status}`
            );
        }

        const data = await response.json();

        console.log("Diocese data:", data);

        if (!data.success) {
            throw new Error(
                data.message || "Failed to load dioceses"
            );
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

        console.error(
            "Error loading dioceses:",
            error
        );

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
                    payment_method
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