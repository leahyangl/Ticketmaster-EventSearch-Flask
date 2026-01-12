# Ticketmaster-EventSearch-Flask

## Description
- **Deployed Applocation**: [here](https://csci571-hw2-yangli.wl.r.appspot.com)

- A full-stack web application that allows users to search for events using the Ticketmaster API. This project demonstrates backend proxying, geolocation integration, and dynamic front-end rendering without the use of heavy frameworks.

- This project was developed as Assignment 2 for CSCI 571: Web Technologies at USC.

## Tech Stack
- **Backend**: Python, Flask
- **Frontend**: JavaScript, HTML5, CSS3
- **APIs**: Ticketmaster API, Google Maps Geocoding API, IPInfo.io
- **Deployment**: Google Cloud Platform (GCP)

## Local Setup
1. **Install dependencies**

    ```
    pip install -r requirements.txt
    ```

2. **Configure Environment Variables**
- Copy [.env.example](./.env.example) to a new file named ```.env```.
- Add your API keys for Ticketmaster, Google Maps, and IPInfo.

3. **Run the application**

    ```
    python main.py
    ```

    Access the app at http://localhost:8080.