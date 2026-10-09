# Provenance

Birth certificate verification integration is based on:

- Official portal: [everify.bdris.gov.bd](https://everify.bdris.gov.bd/) (Office of the Registrar General, Birth and Death Registration)
- HAR analysis and research notes (ILM project, October 2026)
- Public form flow: CSRF token + CAPTCHA + UBRN + DOB multipart POST

The app does **not** bypass CAPTCHA or store verification inputs. Optional Porichoy path requires an authorized organization API key.
