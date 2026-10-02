(function () {
  "use strict";

  function element(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function setAttributes(node, attributes) {
    Object.keys(attributes).forEach(function (key) {
      if (attributes[key] !== undefined && attributes[key] !== null) {
        node.setAttribute(key, String(attributes[key]));
      }
    });
    return node;
  }

  function renderError(container, message) {
    container.textContent = "";
    var error = setAttributes(element("p", "formbuilder-error"), {
      role: "alert",
    });
    error.textContent = message;
    container.appendChild(error);
  }

  function styleForm(form, style) {
    var root = form.closest(".formbuilder-block");
    if (!root) return;
    root.style.setProperty("--formbuilder-text", style.textColor);
    root.style.setProperty("--formbuilder-background", style.background);
    root.style.setProperty("--formbuilder-input-background", style.inputBackground);
    root.style.setProperty("--formbuilder-border", style.borderColor);
    root.style.setProperty("--formbuilder-border-width", style.borderWidth + "px");
    root.style.setProperty("--formbuilder-radius", "var(--formbuilder-radius-" + style.borderRadius + ")");
    root.style.setProperty("--formbuilder-button-background", style.buttonBackground);
    root.style.setProperty("--formbuilder-button-text", style.buttonTextColor);
    root.style.setProperty("--formbuilder-button-radius", "var(--formbuilder-radius-" + style.buttonRadius + ")");
    root.style.setProperty("--formbuilder-font-family", style.fontFamily);
    root.style.setProperty("--formbuilder-font-size", style.fontSize === "sm" ? "0.875rem" : style.fontSize === "lg" ? "1.125rem" : "1rem");
    root.style.setProperty("--formbuilder-form-width", style.formWidth === "sm" ? "32rem" : style.formWidth === "lg" ? "56rem" : style.formWidth === "full" ? "100%" : "48rem");
    root.style.setProperty("--formbuilder-gap", style.fieldSpacing === "compact" ? "0.6rem" : style.fieldSpacing === "spacious" ? "1.5rem" : "1rem");
  }

  function makeControl(field, describedBy) {
    var control;
    var type = field.type === "phone" ? "tel" : field.type;
    if (type === "textarea") {
      control = element("textarea", "formbuilder-control");
      if (field.rows) control.rows = field.rows;
    } else if (type === "select" || type === "multiselect") {
      control = element("select", "formbuilder-control");
      if (type === "multiselect") control.multiple = true;
      field.options.forEach(function (option) {
        var item = element("option");
        item.value = option.value;
        item.textContent = option.label;
        control.appendChild(item);
      });
    } else {
      control = element("input", "formbuilder-control");
      control.type = type === "datetime" ? "datetime-local" : type;
    }
    control.name = field.name;
    control.id = "formbuilder-" + field.name;
    control.disabled = Boolean(field.disabled);
    control.required = Boolean(field.required);
    if (field.type === "phone") control.inputMode = "tel";
    if (field.placeholder && "placeholder" in control) control.placeholder = field.placeholder;
    if (field.defaultValue && type !== "checkbox" && type !== "radio" && type !== "multiselect") {
      control.value = field.defaultValue;
    }
    if (type === "select" && !field.defaultValue) {
      var prompt = element("option");
      prompt.value = "";
      prompt.textContent = "Select an option";
      prompt.disabled = Boolean(field.required);
      prompt.selected = true;
      control.insertBefore(prompt, control.firstChild);
    }
    if (type === "multiselect" && field.defaultValue) {
      var defaults;
      try {
        defaults = JSON.parse(field.defaultValue);
      } catch (_error) {
        defaults = field.defaultValue.split(",").map(function (value) {
          return value.trim();
        });
      }
      if (Array.isArray(defaults)) {
        Array.prototype.forEach.call(control.options, function (option) {
          option.selected = defaults.indexOf(option.value) !== -1;
        });
      }
    }
    if (describedBy) control.setAttribute("aria-describedby", describedBy);
    return control;
  }

  function renderChoice(field, describedBy) {
    var group = element("div", "formbuilder-choice-group");
    group.setAttribute("role", "group");
    group.setAttribute("aria-describedby", describedBy);
    var options = field.type === "yes_no"
      ? [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]
      : field.options;
    options.forEach(function (option) {
      var label = element("label", "formbuilder-choice");
      var input = element("input");
      input.type = field.type === "radio" ? "radio" : "checkbox";
      input.name = field.name;
      input.value = option.value;
      input.required = Boolean(field.required && (field.type === "radio" || field.type === "yes_no"));
      input.disabled = Boolean(field.disabled);
      label.appendChild(input);
      var text = element("span");
      text.textContent = option.label;
      label.appendChild(text);
      group.appendChild(label);
    });
    return group;
  }

  function clearFieldErrors(form) {
    form.querySelectorAll("[data-formbuilder-error]").forEach(function (error) {
      error.remove();
    });
    form.querySelectorAll("[aria-invalid='true']").forEach(function (control) {
      control.removeAttribute("aria-invalid");
      var describedBy = (control.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(function (id) {
          return id && !id.endsWith("-error");
        });
      if (describedBy.length) control.setAttribute("aria-describedby", describedBy.join(" "));
      else control.removeAttribute("aria-describedby");
    });
  }

  function showFieldErrors(form, issues) {
    var firstInvalid = null;
    (Array.isArray(issues) ? issues : []).forEach(function (issue) {
      if (!issue.field) return;
      var field = Array.prototype.find.call(
        form.querySelectorAll(".formbuilder-field"),
        function (candidate) {
          return candidate.dataset.formbuilderField === issue.field;
        },
      );
      if (!field) return;
      var control = field.querySelector("input, textarea, select");
      if (!control) return;
      var error = element("span", "formbuilder-error");
      error.id = control.id + "-error";
      error.dataset.formbuilderError = "true";
      error.textContent = issue.message;
      control.setAttribute("aria-invalid", "true");
      var describedBy = (control.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean);
      if (describedBy.indexOf(error.id) === -1) describedBy.push(error.id);
      control.setAttribute("aria-describedby", describedBy.join(" "));
      field.appendChild(error);
      if (!firstInvalid) firstInvalid = control;
    });
    if (firstInvalid) firstInvalid.focus();
  }

  function renderField(field, columns, instanceKey) {
    var wrapper = element("div", "formbuilder-field");
    var span = Math.max(1, Math.min(columns, Math.round((field.width / 12) * columns)));
    wrapper.style.gridColumn = Math.max(1, field.column) + " / span " + span;
    wrapper.style.gridRow = String(Math.max(1, field.row));
    wrapper.dataset.formbuilderRow = String(field.row);
    wrapper.dataset.formbuilderField = field.name;
    var controlId = "formbuilder-" + instanceKey + "-" + field.name;
    var describedBy = controlId + "-description";
    if (field.type === "hidden" || field.hidden) {
      var hidden = makeControl(field, describedBy);
      hidden.id = controlId;
      hidden.type = "hidden";
      wrapper.appendChild(hidden);
      return wrapper;
    }

    var isChoice = field.type === "radio" || field.type === "checkbox" || field.type === "yes_no";
    var label = element(isChoice ? "legend" : "label", "formbuilder-label");
    if (isChoice) {
      label.id = controlId + "-label";
    } else {
      label.htmlFor = controlId;
    }
    label.textContent = field.label;
    if (field.required) {
      var required = element("span", "formbuilder-required");
      required.textContent = " *";
      required.setAttribute("aria-hidden", "true");
      label.appendChild(required);
    }
    if (isChoice) {
      var fieldset = element("fieldset", "formbuilder-fieldset");
      fieldset.appendChild(label);
      wrapper.appendChild(fieldset);
    } else {
      wrapper.appendChild(label);
    }
    if (field.description) {
      var description = setAttributes(element("span", "formbuilder-description"), {
        id: describedBy,
      });
      description.textContent = field.description;
      wrapper.appendChild(description);
    }

    var control =
      field.type === "radio" || field.type === "checkbox" || field.type === "yes_no"
        ? renderChoice(field, field.description ? describedBy : undefined)
        : makeControl(field, field.description ? describedBy : undefined);
    if (isChoice) {
      control.setAttribute("aria-labelledby", label.id);
    } else {
      control.id = controlId;
    }
    if (isChoice) {
      wrapper.querySelector("fieldset").appendChild(control);
    } else {
      wrapper.appendChild(control);
    }
    return wrapper;
  }

  function collectValues(form) {
    var values = {};
    new FormData(form).forEach(function (value, key) {
      if (key in values) {
        values[key] = Array.isArray(values[key]) ? values[key].concat([value]) : [values[key], value];
      } else {
        values[key] = value;
      }
    });
    return values;
  }

  function renderBlock(root, payload) {
    root.textContent = "";
    var form = element("form", "formbuilder-form");
    form.noValidate = false;
    form.setAttribute("aria-label", root.getAttribute("aria-label") || "Form");
    form.style.setProperty("--formbuilder-columns", String(payload.form.columns));
    styleForm(form, payload.form.style);
    var fields = element("div", "formbuilder-fields");
    payload.form.fields.forEach(function (field) {
      fields.appendChild(renderField(field, payload.form.columns, root.dataset.formBuilderInstance));
    });
    form.appendChild(fields);
    var actions = element("div", "formbuilder-actions");
    var submit = element("button", "formbuilder-submit");
    submit.type = "submit";
    submit.textContent = payload.form.settings.submitLabel || "Submit";
    actions.appendChild(submit);
    var messages = element("div", "formbuilder-messages");
    messages.setAttribute("aria-live", "polite");
    actions.appendChild(messages);
    form.appendChild(actions);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      messages.textContent = "";
      clearFieldErrors(form);
      submit.disabled = true;
      fetch(root.dataset.formBuilderEndpoint + "/" + encodeURIComponent(root.dataset.formBuilderFormId), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ values: collectValues(form) }),
      })
        .then(function (response) {
          return response.json().then(function (body) {
            if (!response.ok) throw body;
            return body;
          });
        })
        .then(function (body) {
          messages.textContent = body.message || payload.form.settings.successMessage;
          form.reset();
        })
        .catch(function (body) {
          showFieldErrors(form, body && body.issues);
          messages.textContent = body.error || payload.form.settings.errorMessage;
        })
        .finally(function () {
          submit.disabled = false;
        });
    });
    root.appendChild(form);
  }

  document.querySelectorAll("[data-form-builder-form-id]").forEach(function (root, index) {
    if (root.dataset.formBuilderInitialized === "true") return;
    root.dataset.formBuilderInitialized = "true";
    root.dataset.formBuilderInstance = String(index);
    var endpoint = root.dataset.formBuilderEndpoint;
    var publicId = root.dataset.formBuilderFormId;
    if (!endpoint || !publicId) return;
    fetch(endpoint + "/" + encodeURIComponent(publicId), {
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) throw new Error("not found");
        return response.json();
      })
      .then(function (payload) {
        if (!payload.ok || !payload.form) throw new Error("not found");
        renderBlock(root, payload);
      })
      .catch(function () {
        renderError(root, "This form is currently unavailable.");
      });
  });
})();
