export const signupEmailVerificationTemplate = `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="format-detection" content="telephone=no">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify your Calibrate recovery email</title>
      <style type="text/css" emogrify="no">
        #outlook a {
          padding: 0;
        }

        .ExternalClass {
          width: 100%;
        }

        .ExternalClass,
        .ExternalClass p,
        .ExternalClass span,
        .ExternalClass font,
        .ExternalClass td,
        .ExternalClass div {
          line-height: 100%;
        }

        table td {
          border-collapse: collapse;
          mso-line-height-rule: exactly;
        }

        .editable.image {
          font-size: 0 !important;
          line-height: 0 !important;
        }

        .nl2go_preheader {
          display: none !important;
          mso-hide: all !important;
          mso-line-height-rule: exactly;
          visibility: hidden !important;
          line-height: 0px !important;
          font-size: 0px !important;
        }

        body {
          width: 100% !important;
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
          margin: 0;
          padding: 0;
        }

        img {
          outline: none;
          text-decoration: none;
          -ms-interpolation-mode: bicubic;
        }

        a img {
          border: none;
        }

        table {
          border-collapse: collapse;
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
        }

        th {
          font-weight: normal;
          text-align: left;
        }

        *[class="gmail-fix"] {
          display: none !important;
        }
      </style>
      <style type="text/css" emogrify="no">
        @media (max-width: 600px) {
          .gmx-killpill {
            content: ' \u03D1';
          }
        }
      </style>
      <style type="text/css" emogrify="no">
        @media (max-width: 600px) {
          .gmx-killpill {
            content: ' \u03D1';
          }

          .r0-o {
            border-style: solid !important;
            margin: 0 auto 0 auto !important;
            width: 320px !important
          }

          .r1-i {
            background-color: #ffffff !important
          }

          .r2-c {
            box-sizing: border-box !important;
            text-align: center !important;
            valign: top !important;
            width: 100% !important
          }

          .r3-o {
            border-style: solid !important;
            margin: 0 auto 0 auto !important;
            width: 100% !important
          }

          .r4-i {
            padding-left: 20px !important;
            padding-right: 20px !important;
            padding-top: 30px !important
          }

          .r5-c {
            box-sizing: border-box !important;
            display: block !important;
            valign: top !important;
            width: 100% !important
          }

          .r6-o {
            border-style: solid !important;
            width: 100% !important
          }

          .r7-o {
            border-style: solid !important;
            margin: 0 auto 0 0 !important;
            width: 100% !important
          }

          .r8-i {
            text-align: left !important
          }

          .r9-i {
            padding-top: 15px !important;
            text-align: left !important
          }

          .r10-i {
            padding-left: 20px !important;
            padding-right: 20px !important;
            padding-top: 20px !important
          }

          .r11-i {
            padding-left: 0px !important;
            padding-right: 0px !important
          }

          body {
            -webkit-text-size-adjust: none
          }

          .nl2go-responsive-hide {
            display: none
          }

          .nl2go-body-table {
            min-width: unset !important
          }

          .mobshow {
            height: auto !important;
            overflow: visible !important;
            max-height: unset !important;
            visibility: visible !important
          }

          .resp-table {
            display: inline-table !important
          }

          .magic-resp {
            display: table-cell !important
          }
        }
      </style>
      <style type="text/css">
        p,
        h1,
        h2,
        h3,
        h4,
        ol,
        ul,
        li {
          margin: 0;
        }

        .nl2go-default-textstyle {
          color: #3f3d56;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 20px;
          line-height: 1.4;
          word-break: break-word
        }

        .default-button {
          color: #ffffff;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 20px;
          font-style: normal;
          font-weight: bold;
          line-height: 1.15;
          text-decoration: none;
          word-break: break-word
        }

        a,
        a:link {
          color: #3f3d56;
          text-decoration: none
        }

        .default-heading1 {
          color: #434343;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 50px;
          word-break: break-word
        }

        .default-heading2 {
          color: #434343;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 35px;
          word-break: break-word
        }

        .default-heading3 {
          color: #434343;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 26px;
          word-break: break-word
        }

        .default-heading4 {
          color: #434343;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 18px;
          word-break: break-word
        }

        .nl2go_class_impressum {
          color: #999999;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 12px;
          font-style: italic;
          word-break: break-word
        }

        .sib_class_16_black_b {
          color: #434343;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 16px;
          font-weight: 700;
          word-break: break-word
        }

        .sib_class_16_black_reg {
          color: #434343;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 16px;
          word-break: break-word
        }

        .sib_class_20_white_b {
          color: #ffffff;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 20px;
          font-weight: 700;
          word-break: break-word
        }

        .sib_class_26_black_b {
          color: #434343;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 26px;
          font-weight: 700;
          word-break: break-word
        }

        .sib_class_28_black_reg {
          color: #434343;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 28px;
          word-break: break-word
        }

        .sib_class_35_black_b {
          color: #434343;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 35px;
          font-weight: 700;
          word-break: break-word
        }

        .sib_class_50_black_b {
          color: #434343;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 50px;
          font-weight: 700;
          word-break: break-word
        }

        .sib_class_70_black_reg {
          color: #434343;
          font-family: Montserrat, Arial, Helvetica, sans-serif;
          font-size: 70px;
          word-break: break-word
        }

        a[x-apple-data-detectors] {
          color: inherit !important;
          text-decoration: inherit !important;
          font-size: inherit !important;
          font-family: inherit !important;
          font-weight: inherit !important;
          line-height: inherit !important;
        }

        .no-show-for-you {
          border: none;
          display: none;
          float: none;
          font-size: 0;
          height: 0;
          line-height: 0;
          max-height: 0;
          mso-hide: all;
          overflow: hidden;
          table-layout: fixed;
          visibility: hidden;
          width: 0;
        }
      </style>
      <!--[if mso]>
              <xml>
                <o:OfficeDocumentSettings>
                  <o:AllowPNG/>
                  <o:PixelsPerInch>96</o:PixelsPerInch>
                </o:OfficeDocumentSettings>
              </xml>
              <![endif]-->
    </head>
    <body bgcolor="#ffffff" text="#3f3d56" link="#3f3d56" yahoo="fix" style="background-color: #ffffff;">
      <table cellspacing="0" cellpadding="0" border="0" role="presentation" class="nl2go-body-table" width="100%" style="background-color: #ffffff; width: 100%;">
        <tr>
          <td>
            <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="600" align="center" class="r0-o" style="table-layout: fixed; width: 600px;">
              <tr>
                <td valign="top" class="r1-i" style="background-color: #ffffff;">
                  <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="center" class="r3-o" style="table-layout: fixed; width: 100%;">
                    <tr>
                      <td class="r4-i" style="padding-top: 60px;">
                        <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation">
                          <tr>
                            <th width="100%" valign="top" class="r5-c" style="font-weight: normal;">
                              <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="left" class="r7-o" style="table-layout: fixed; width: 100%;">
                                <tr>
                                  <td align="left" valign="top" class="r8-i nl2go-default-textstyle" style="color: #3f3d56; font-family: Montserrat,Arial,Helvetica,sans-serif; font-size: 20px; line-height: 1.4; word-break: break-word; text-align: left;">
                                    <div>
                                      <p style="margin: 0;">
                                        <span style="font-size: 26px;">
                                          <strong>{{params.code}}</strong>
                                        </span>
                                      </p>
                                    </div>
                                  </td>
                                </tr>
                              </table>
                              <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="left" class="r7-o" style="table-layout: fixed; width: 100%;">
                                <tr>
                                  <td align="left" valign="top" class="r9-i nl2go-default-textstyle" style="color: #3f3d56; font-family: Montserrat,Arial,Helvetica,sans-serif; font-size: 20px; line-height: 1.4; word-break: break-word; padding-top: 15px; text-align: left;">
                                    <div>
                                      <p style="margin: 0;">Enter this code to verify your recovery email and continue creating your Calibrate account.</p>
                                      <p style="margin: 0;">
                                        <br>
                                      </p>
                                      <p style="margin: 0;">Note: This code will expire in 10 minutes.</p>
                                    </div>
                                  </td>
                                </tr>
                              </table>
                            </th>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="center" class="r3-o" style="table-layout: fixed; width: 100%;">
                    <tr>
                      <td class="r10-i" style="padding-top: 50px;">
                        <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation">
                          <tr>
                            <th width="100%" valign="top" class="r5-c" style="font-weight: normal;">
                              <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="600" align="center" class="r3-o" style="table-layout: fixed; width: 600px;">
                                <tr>
                                  <td class="r11-i" style="font-size: 0px; line-height: 0px;">
                                    <img src="http://img-st2.mailinblue.com/2037886/images/rnb/original/5e8b17962b8ec7020d7c2f85.png" width="600" border="0" style="display: block; width: 100%;">
                                  </td>
                                </tr>
                              </table>
                            </th>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;
