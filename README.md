# Report Generative Security Tool (RGS)

<div align="center">
    <img src="static/LOGO_C.png" alt="RGS Logo" width="200" />
</div>


The **Report Generative Security Tool (RGS)** is an innovative application developed to streamline the process of generating comprehensive security audit reports. Utilizing the power of Generative AI, RGS simplifies the reporting process, providing detailed analyses and actionable recommendations for identified vulnerabilities. This tool was developed for the Generative AI Agents Developer Contest organized by NVIDIA and LangChain.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/downloads/release/python-380/)
[![Flask](https://img.shields.io/badge/Flask-1.1.2-red.svg)](https://flask.palletsprojects.com/en/1.1.x/)
![NVIDIA RTX](https://img.shields.io/badge/NVIDIA-RTX-green.svg)
![LangChain](https://img.shields.io/badge/LangChain-yellow.svg)
![Mistral](https://img.shields.io/badge/Mistral-blue.svg)

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Generative AI Integration**: Leverages AI to generate comprehensive vulnerability reports.
- **Risk, Priority, and Complexity Analysis**: Visual charts to illustrate vulnerability distributions.
- **Automatic Report Generation**: Easily create professional-grade security audit reports.
- **Database Management**: Efficiently manage vulnerabilities and reports with SQLite.
- **User-Friendly Interface**: Intuitive web interface for managing and generating reports.

## Installation

To get started with RGS, follow these steps:

1. **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/RGS.git
    cd RGS
    ```

2. **Install the necessary dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

3. **Initialize the database**:
    ```bash
    python app.py
    ```

## Usage

1. **Run the application**:
    ```bash
    python app.py
    ```

2. **Access the application**:
    Open your web browser and navigate to `http://127.0.0.1:5000/`.

3. **Generate Reports**:
    - Enter the company name, audit date, and number of vulnerabilities.
    - Click on "Generate Fields" to input vulnerability details.
    - Submit vulnerabilities and generate the report.

## Project Structure

