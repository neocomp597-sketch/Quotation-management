const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../frontend/src/pages/Register.jsx');
let content = fs.readFileSync(p, 'utf8');

content = content.replace(
`  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });`,
`  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyName: "",
    password: "",
    confirmPassword: "",
  });`
);

content = content.replace(
`  const { name, email, password, confirmPassword } = formData;`,
`  const { name, email, companyName, password, confirmPassword } = formData;`
);

content = content.replace(
`      const res = await authService.register({
        name,
        email,
        password,
      });`,
`      const res = await authService.register({
        name,
        email,
        companyName,
        password,
      });`
);

content = content.replace(
`          </div>
          <div className="form-group">
            <label>Password</label>`,
`          </div>
          <div className="form-group">
            <label>Company Name</label>
            <input
              type="text"
              name="companyName"
              value={companyName}
              onChange={onChange}
              placeholder="Your Company Ltd"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>`
);

fs.writeFileSync(p, content, 'utf8');
console.log('Patched Register.jsx successfully.');
