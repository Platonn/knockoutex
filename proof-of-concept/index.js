console.clear();

function padZeros(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

function getNow() {
	var d = new Date(); // for now
	var h = padZeros(d.getHours(), 2);
	var m = padZeros(d.getMinutes(), 2);
	var s = padZeros(d.getSeconds(), 2);
  var ms = padZeros(d.getMilliseconds(), 3);
  return h + ':' + m + ':' + s + '.' + ms;
}

function TodosHttpService($){
  var resolveWithDelay = function(promise, data) {
  	setTimeout(function(){ promise.resolve(data); }, 2000);
  };
  
  this.getTodos = function() {
  	var result = $.Deferred();
    var mockedData = [
			{ name: 'get whole list from backend', done: true },
      { name: 'finish presentation ', done: true },
			{ name: 'discuss! ', done: false },
		];
    resolveWithDelay(result, mockedData);
    return result;
  }
  
  return this;
};
TodosHttpService = new TodosHttpService(jQuery);

var utils = {
	traverseSeen: [],
  traverseObservables: function(obj) {
  	seen = [];
   utils._traverseObservables(obj());
  },
  _traverseObservables: function(obj) {
  	if (utils.isPrimitive(obj)) {
			return;
   	}   
  	Object.keys(obj).forEach(function(key){
    	if(obj.hasOwnProperty(key)) {
      	if(ko.isObservable(obj[key])){
        	var value = obj[key]();
         
         	if(seen.indexOf(value) === -1) {
         		utils._traverseObservables(value);
         	}
        }
      }
   	});
  }, 
  
  mapToObservable: function(obj){
  	if (utils.isPrimitive(obj)) {
			return ko.observable(obj);
    }
    
    var isArray = Array.isArray(obj);
    var newObj = isArray ? [] : {};
    
  	Object.keys(obj).forEach(function(key){
    	if(obj.hasOwnProperty(key)) {
      	newObj[key] = utils.mapToObservable(obj[key]);
      }
    });
    
    return isArray ? ko.observableArray(newObj) : ko.observable(newObj);
  },
	isPrimitive: function(test) {
		return (test !== Object(test));
	},
  setReactiveProperty: function(obj, key, val) {
  	if(obj[key] !== undefined) {
    	obj[key](val)
    } else {
    	obj[key] = ko.observable(val);
    }
  },
  reactiveExtend: function(target, obj) {
  	Object.keys(obj).forEach(function(key){
    	if(obj.hasOwnProperty(key)) {
      	utils.setReactiveProperty(target, key, obj[key]);
      }
    });
  },
  extend: function(target, obj) {
  	Object.keys(obj).forEach(function(key){
    	if(obj.hasOwnProperty(key)) {
      	target[key] = obj[key];
      }
    });
  }
};

var mutationTypes = {
	SET_FIRSTNAME: 'SET_FIRSTNAME',
  SET_SURNAME: 'SET_SURNAME',
  UPDATE_PERSON: 'UPDATE_PERSON',
  
  SET_TODOS: 'SET_TODOS',
  PUSH_TODO: 'PUSH_TODO',
  REMOVE_TODO_BY_ID: 'REMOVE_TODO_BY_ID',
  UPDATE_TODO: 'UPDATE_TODO'
};

var mutations = function(mutationTypes) {
  var mutations = {};
  
  //person
  mutations[mutationTypes.SET_FIRSTNAME] = function(state, payload) {
  	state().person().firstname(payload);
  };
  mutations[mutationTypes.SET_SURNAME] = function(state, payload) {
  	state().person().surname(payload);
  };
  mutations[mutationTypes.UPDATE_PERSON] = function(state, payload) {
  	utils.reactiveExtend(state().person(), payload)
  };
    
  //todos:
  mutations[mutationTypes.SET_TODOS] = function(state, payload) {
  	state().todos(payload.map(utils.mapToObservable));
  };
  mutations[mutationTypes.PUSH_TODO] = function(state, payload) {
  	state().todos.push(utils.mapToObservable(payload.todo));
  };
  mutations[mutationTypes.REMOVE_TODO_BY_ID] = function(state, payload) {
   	state().todos.splice(payload.id, 1);
  };
	mutations[mutationTypes.UPDATE_TODO] = function(state, payload) {
  	utils.reactiveExtend(state().todos()[payload.id](), payload.todo);
	};
  
  return mutations;
}(mutationTypes);


var actionTypes = {
	GET_TODOS: 'GET_TODOS',
  TOGGLE_DONE_TODO: 'TOGGLE_DONE_TODO',
  UPDATE_PERSON: 'UPDATE_PERSON'
};


var actions = {};
actions[actionTypes.GET_TODOS] = function(store, payload) {
 	return TodosHttpService.getTodos()
   	.done(function(result){
  			store.commit(mutationTypes.SET_TODOS, result);
			});
};
actions[actionTypes.TOGGLE_DONE_TODO] = function(store, payload) {
	var oldDoneValue = store.getters.todos()[payload.id]().done();
	store.commit(mutationTypes.UPDATE_TODO, { id: payload.id, todo: {done: !oldDoneValue} });
};
actions[actionTypes.UPDATE_PERSON] = function(store, payload) {
	store.commit(mutationTypes.UPDATE_PERSON, payload);
};

var initState = {
	person: {
		firstname: null,
		surname: null
	},
	todos: []
};

var getters = {
	person: function(state) { return state().person },
  todos: function(state) { return state().todos },
};

var ENVIRONMENT = 'dev';

function Logger(console){
	var self = this;
  var blan
 	Object.keys(console).forEach(function(key){
		if(ENVIRONMENT==='dev') {
			self[key] = console[key];
		} else {
    	self[key] = function() {};
    }
  });
  
  return self;
}(console);

var logger = new Logger(console);

function Store(initState, mutations, getters, actions) {
	var self = this;
  var _isCommiting = false;
  
  this.isDebug = true;
  this.isStrict = true;
  
	//state
  var state = utils.mapToObservable(initState);
  
  if(this.isStrict && this.isDebug) {
  	enableStrictMode();
  }

	var stateChangeComputed;
	function enableStrictMode(){
  	if (ko.isComputed(stateChangeComputed)) {
    	stateChangeComputed.dispose();
    }
    stateChangeComputed = ko.computed(function(){
    	utils.traverseObservables(state);
 			if(!ko.computedContext.isInitial()){
      	checkForCommitting();
      }
    });
  }
  
  function checkForCommitting(){
    if(self.isStrict && !_isCommiting){
    	logger.error('Do not mutate store state outside mutation handlers');
    }
  }

	// getters
  this.getters = {};
	Object.keys(getters).forEach(function(key){
  	if(getters.hasOwnProperty(key)) {
			var getterValue = getters[key](state);
			self.getters[key] = getterValue;
		}
  });
  
  //commit
  this.commit = function(mutationType, payload){
    _isCommiting = true;

		var logMessage;
    if(this.isDebug) {
    	if(!mutations[mutationType]) {
    		console.error(mutations, 'mutations does not contain "' + mutationType + '"');
    	}
    	logMessage = {
      	mutationType: mutationType,
        payload: payload,
        prevState: ko.toJS(state())
      };
    }
    
    mutations[mutationType](state, payload);
    
    if(this.isDebug) {
    	logMessage.nextState = ko.toJS(state());
    	logger.log(getNow(), logMessage);
    }
    
    _isCommiting = false;
  };
  
  //dispatch
  this.dispatch = function(actionType, payload) {
    if(this.isDebug) {
    	if(!actions[actionType]) {
    		console.error(actions, 'actions does not contain "' + actionType + '"');
    	}
    
      var logMessage = {
      	actionType: actionType,
        payload: payload
      };
    	logger.log(getNow(), logMessage);
      
      return actions[actionType](self, payload);;
		}
  };
  
	return this;
};
var store = new Store(initState, mutations, getters, actions);

var ViewModel = function(store){
	this.globalState = ko.observable({
  	person: store.getters.person,
  	todos: store.getters.todos
  });
  
  this.formState = ko.observable({
      person: utils.mapToObservable(ko.toJS(this.globalState().person()))
  });
  this.isEditMode = ko.observable(false);
  this.isEditDisabled = ko.observable(true);
  
  this.saveChanges = function(){
		this.isEditMode(false);
  	store.dispatch(actionTypes.UPDATE_PERSON, ko.toJS(this.formState().person()));
  };
  this.startEditMode = function(){
		if(!this.isEditDisabled()) {
			this.formState({
				person: utils.mapToObservable(ko.toJS(this.globalState().person()))
    	});
			this.isEditMode(true);
    }
  };
  this.toggleDone = function($index) {
  	store.dispatch(actionTypes.TOGGLE_DONE_TODO, {id: $index()});
  };
  
	return this;
};
var viewModel = new ViewModel(store);

var slow = 300;

ko.applyBindings(viewModel, document.body);
setTimeout(function(){
store.commit(mutationTypes.SET_FIRSTNAME, 'John');
store.commit(mutationTypes.SET_SURNAME, 'Smith');
}, 1*slow);

setTimeout(function(){
store.commit(mutationTypes.SET_TODOS, [
	{ name: 'buy milk', done: true },
	{ name: 'book tickets', done: false },
]);
}, 2*slow);

setTimeout(function(){
store.commit(mutationTypes.SET_FIRSTNAME, 'Jan');
store.commit(mutationTypes.SET_SURNAME, 'Kowalski');
}, 3*slow);

setTimeout(function(){
store.commit(mutationTypes.UPDATE_TODO, {
 	id: 1,
  todo: { name: 'take a shower', done: false }
});
}, 4*slow);

setTimeout(function(){
store.commit(mutationTypes.PUSH_TODO, {todo: {name:'call mum', done:false}});
}, 5*slow);

setTimeout(function(){
store.commit(mutationTypes.REMOVE_TODO_BY_ID, {id: 0});
}, 6*slow);

setTimeout(function(){
store.commit(mutationTypes.UPDATE_TODO, {id: 1, todo: {done: true}});
viewModel.isEditDisabled(false);
}, 7*slow);

setTimeout(function(){
store.dispatch(actionTypes.GET_TODOS)
}, 8*slow);
